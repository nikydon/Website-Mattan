#pragma once

#include <JuceHeader.h>

//==============================================================================
// KickRumble — kick drum sub-bass rumble enhancer.
//
// Signal flow:
//   Input -> Transient Detector -> triggers Rumble Oscillator -> Mix with dry
//==============================================================================
class KickRumbleAudioProcessor : public juce::AudioProcessor
{
public:
    KickRumbleAudioProcessor();
    ~KickRumbleAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;

    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;

    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramByName(const juce::String& name) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState apvts;

private:
    // Creates the parameter layout exposed to the DAW.
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    // --- Transient detector state (per-channel) ---
    // Envelope followers: fast reacts to transients, slow tracks the average.
    std::vector<float> envFast;
    std::vector<float> envSlow;
    // Whether we are in a "triggered" state (waiting for the transient to pass
    // before we can re-trigger).
    std::vector<bool> triggered;

    // --- Rumble oscillator state (per-channel) ---
    std::vector<double> oscPhase;       // Current sine oscillator phase [0, 2pi)
    std::vector<float>  rumbleEnvLevel; // Current amplitude of the rumble envelope
    std::vector<float>  rumbleEnvDelta; // Per-sample decay decrement

    // Cached sample rate for DSP calculations.
    double currentSampleRate = 44100.0;

    // Smoothed parameter values to avoid zipper noise.
    juce::SmoothedValue<float> smoothedFreq;
    juce::SmoothedValue<float> smoothedMix;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(KickRumbleAudioProcessor)
};
