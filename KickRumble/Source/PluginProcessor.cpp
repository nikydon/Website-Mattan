#include "PluginProcessor.h"
#include "PluginEditor.h"

//==============================================================================
// Parameter ID strings — used everywhere to avoid typos.
//==============================================================================
static const juce::String PARAM_THRESHOLD = "threshold";
static const juce::String PARAM_FREQ      = "rumbleFreq";
static const juce::String PARAM_DECAY     = "decay";
static const juce::String PARAM_MIX       = "mix";

//==============================================================================
KickRumbleAudioProcessor::KickRumbleAudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withInput("Input",   juce::AudioChannelSet::stereo(), true)
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "Parameters", createParameterLayout())
{
}

KickRumbleAudioProcessor::~KickRumbleAudioProcessor() {}

//==============================================================================
juce::AudioProcessorValueTreeState::ParameterLayout
KickRumbleAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // Threshold: transient detection sensitivity in dB (-60 to 0).
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { PARAM_THRESHOLD, 1 },
        "Threshold",
        juce::NormalisableRange<float>(-60.0f, 0.0f, 0.1f),
        -24.0f,
        juce::AudioParameterFloatAttributes().withLabel("dB")));

    // Rumble Freq: pitch of the sub-bass sine (30–100 Hz).
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { PARAM_FREQ, 1 },
        "Rumble Freq",
        juce::NormalisableRange<float>(30.0f, 100.0f, 0.1f),
        55.0f,
        juce::AudioParameterFloatAttributes().withLabel("Hz")));

    // Decay: rumble tail length in milliseconds (50–500 ms).
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { PARAM_DECAY, 1 },
        "Decay",
        juce::NormalisableRange<float>(50.0f, 500.0f, 1.0f),
        200.0f,
        juce::AudioParameterFloatAttributes().withLabel("ms")));

    // Mix: wet/dry blend (0–100%).
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { PARAM_MIX, 1 },
        "Mix",
        juce::NormalisableRange<float>(0.0f, 100.0f, 0.1f),
        50.0f,
        juce::AudioParameterFloatAttributes().withLabel("%")));

    return { params.begin(), params.end() };
}

//==============================================================================
void KickRumbleAudioProcessor::prepareToPlay(double sampleRate, int /*samplesPerBlock*/)
{
    currentSampleRate = sampleRate;

    const int numCh = getTotalNumOutputChannels();

    // Initialise per-channel DSP state.
    envFast.assign(static_cast<size_t>(numCh), 0.0f);
    envSlow.assign(static_cast<size_t>(numCh), 0.0f);
    triggered.assign(static_cast<size_t>(numCh), false);

    oscPhase.assign(static_cast<size_t>(numCh), 0.0);
    rumbleEnvLevel.assign(static_cast<size_t>(numCh), 0.0f);
    rumbleEnvDelta.assign(static_cast<size_t>(numCh), 0.0f);

    // Prepare smoothed parameter helpers (10 ms ramp).
    smoothedFreq.reset(sampleRate, 0.01);
    smoothedMix.reset(sampleRate, 0.01);
}

void KickRumbleAudioProcessor::releaseResources() {}

bool KickRumbleAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    // Support mono and stereo — input and output must match.
    const auto& mainIn  = layouts.getMainInputChannelSet();
    const auto& mainOut = layouts.getMainOutputChannelSet();

    if (mainOut != mainIn)
        return false;

    if (mainOut != juce::AudioChannelSet::mono()
        && mainOut != juce::AudioChannelSet::stereo())
        return false;

    return true;
}

//==============================================================================
void KickRumbleAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                             juce::MidiBuffer& /*midiMessages*/)
{
    juce::ScopedNoDenormals noDenormals;

    const int numChannels = buffer.getNumChannels();
    const int numSamples  = buffer.getNumSamples();

    // ---- Fetch current parameter values ----
    const float thresholdDb = apvts.getRawParameterValue(PARAM_THRESHOLD)->load();
    const float freq        = apvts.getRawParameterValue(PARAM_FREQ)->load();
    const float decayMs     = apvts.getRawParameterValue(PARAM_DECAY)->load();
    const float mixPct      = apvts.getRawParameterValue(PARAM_MIX)->load();

    // Convert threshold from dB to linear amplitude.
    const float thresholdLin = juce::Decibels::decibelsToGain(thresholdDb);

    // Set smoothed targets for this block.
    smoothedFreq.setTargetValue(freq);
    smoothedMix.setTargetValue(mixPct / 100.0f);

    // ---- Envelope follower coefficients ----
    // Fast attack ~0.1 ms — reacts instantly to transients.
    const float fastAttackCoeff  = 1.0f - std::exp(-1.0f / static_cast<float>(currentSampleRate * 0.0001));
    // Fast release ~5 ms.
    const float fastReleaseCoeff = 1.0f - std::exp(-1.0f / static_cast<float>(currentSampleRate * 0.005));
    // Slow attack ~20 ms — tracks the average level.
    const float slowAttackCoeff  = 1.0f - std::exp(-1.0f / static_cast<float>(currentSampleRate * 0.02));
    // Slow release ~100 ms.
    const float slowReleaseCoeff = 1.0f - std::exp(-1.0f / static_cast<float>(currentSampleRate * 0.1));

    // ---- Rumble attack ramp (fade-in to avoid clicks) ----
    // ~2 ms linear fade-in expressed as a per-sample increment.
    const float attackRampInc = 1.0f / static_cast<float>(currentSampleRate * 0.002);

    // ---- Process each sample ----
    for (int s = 0; s < numSamples; ++s)
    {
        // Advance smoothed parameters.
        const float currentFreq = smoothedFreq.getNextValue();
        const float currentMix  = smoothedMix.getNextValue();

        // Phase increment for the sine oscillator at the current frequency.
        const double phaseInc = (2.0 * juce::MathConstants<double>::pi * currentFreq) / currentSampleRate;

        // Compute rumble envelope decay delta for this sample.
        // The envelope goes from 1 -> 0 over decayMs milliseconds.
        const float decaySamples = static_cast<float>(currentSampleRate) * (decayMs / 1000.0f);
        const float envDecayDelta = 1.0f / decaySamples;

        for (int ch = 0; ch < numChannels; ++ch)
        {
            auto* channelData = buffer.getWritePointer(ch);
            const float drySample = channelData[s];
            const float absInput  = std::fabs(drySample);

            // ---- Stage 1: Envelope follower (transient detection) ----
            // Fast envelope — hugs the peaks tightly.
            if (absInput > envFast[static_cast<size_t>(ch)])
                envFast[static_cast<size_t>(ch)] += fastAttackCoeff * (absInput - envFast[static_cast<size_t>(ch)]);
            else
                envFast[static_cast<size_t>(ch)] += fastReleaseCoeff * (absInput - envFast[static_cast<size_t>(ch)]);

            // Slow envelope — tracks the average level.
            if (absInput > envSlow[static_cast<size_t>(ch)])
                envSlow[static_cast<size_t>(ch)] += slowAttackCoeff * (absInput - envSlow[static_cast<size_t>(ch)]);
            else
                envSlow[static_cast<size_t>(ch)] += slowReleaseCoeff * (absInput - envSlow[static_cast<size_t>(ch)]);

            // A transient is detected when the fast envelope exceeds the slow
            // envelope by more than the threshold, AND we are not already in a
            // triggered state (prevents re-triggering on the same hit).
            const float diff = envFast[static_cast<size_t>(ch)] - envSlow[static_cast<size_t>(ch)];

            if (!triggered[static_cast<size_t>(ch)] && diff > thresholdLin)
            {
                // ---- Stage 2: Trigger rumble ----
                triggered[static_cast<size_t>(ch)] = true;
                rumbleEnvLevel[static_cast<size_t>(ch)] = attackRampInc; // Start with tiny value (fade-in)
                rumbleEnvDelta[static_cast<size_t>(ch)] = envDecayDelta;
                oscPhase[static_cast<size_t>(ch)] = 0.0; // Reset phase for clean sine start
            }

            // Allow re-triggering once the fast envelope drops back close to the slow one.
            if (triggered[static_cast<size_t>(ch)] && diff < thresholdLin * 0.5f)
                triggered[static_cast<size_t>(ch)] = false;

            // ---- Stage 3: Rumble oscillator + envelope ----
            float rumbleSample = 0.0f;

            if (rumbleEnvLevel[static_cast<size_t>(ch)] > 0.0f)
            {
                // Generate sine wave.
                rumbleSample = std::sin(static_cast<float>(oscPhase[static_cast<size_t>(ch)]));

                // Apply envelope (handles both attack ramp-up and decay).
                rumbleSample *= std::min(rumbleEnvLevel[static_cast<size_t>(ch)], 1.0f);

                // Advance oscillator phase.
                oscPhase[static_cast<size_t>(ch)] += phaseInc;
                if (oscPhase[static_cast<size_t>(ch)] >= 2.0 * juce::MathConstants<double>::pi)
                    oscPhase[static_cast<size_t>(ch)] -= 2.0 * juce::MathConstants<double>::pi;

                // During attack phase, ramp up quickly to 1.0.
                if (rumbleEnvLevel[static_cast<size_t>(ch)] < 1.0f)
                    rumbleEnvLevel[static_cast<size_t>(ch)] += attackRampInc;

                // Decay: decrease envelope level toward zero.
                if (rumbleEnvLevel[static_cast<size_t>(ch)] >= 1.0f)
                    rumbleEnvLevel[static_cast<size_t>(ch)] -= rumbleEnvDelta[static_cast<size_t>(ch)];

                // Clamp to zero when envelope is spent.
                if (rumbleEnvLevel[static_cast<size_t>(ch)] <= 0.0f)
                    rumbleEnvLevel[static_cast<size_t>(ch)] = 0.0f;
            }

            // ---- Stage 4: Mix dry + rumble ----
            channelData[s] = drySample + rumbleSample * currentMix;
        }
    }
}

//==============================================================================
juce::AudioProcessorEditor* KickRumbleAudioProcessor::createEditor()
{
    // Use JUCE's generic editor — shows all parameters with default sliders.
    // We'll build a custom UI later.
    return new juce::GenericAudioProcessorEditor(*this);
}

bool KickRumbleAudioProcessor::hasEditor() const { return true; }

//==============================================================================
const juce::String KickRumbleAudioProcessor::getName() const { return JucePlugin_Name; }
bool KickRumbleAudioProcessor::acceptsMidi()  const { return false; }
bool KickRumbleAudioProcessor::producesMidi() const { return false; }
bool KickRumbleAudioProcessor::isMidiEffect() const { return false; }
double KickRumbleAudioProcessor::getTailLengthSeconds() const { return 0.5; }

int KickRumbleAudioProcessor::getNumPrograms()                    { return 1; }
int KickRumbleAudioProcessor::getCurrentProgram()                  { return 0; }
void KickRumbleAudioProcessor::setCurrentProgram(int)              {}
const juce::String KickRumbleAudioProcessor::getProgramName(int)   { return {}; }
void KickRumbleAudioProcessor::changeProgramByName(const juce::String&) {}

//==============================================================================
void KickRumbleAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    // Serialize parameter state to XML for DAW session recall.
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void KickRumbleAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    // Restore parameter state from XML.
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, sizeInBytes));
    if (xml != nullptr && xml->hasTagName(apvts.state.getType()))
        apvts.replaceState(juce::ValueTree::fromXml(*xml));
}

//==============================================================================
// Plugin instantiation entry point — required by JUCE.
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new KickRumbleAudioProcessor();
}
