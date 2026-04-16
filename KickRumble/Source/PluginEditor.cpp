#include "PluginEditor.h"

//==============================================================================
KickRumbleAudioProcessorEditor::KickRumbleAudioProcessorEditor(KickRumbleAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p)
{
    // Placeholder size — the GenericAudioProcessorEditor is used instead
    // (see PluginProcessor::createEditor). This editor exists as a scaffold
    // for when a custom UI is built.
    setSize(400, 300);
}

KickRumbleAudioProcessorEditor::~KickRumbleAudioProcessorEditor() {}

void KickRumbleAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colours::black);
    g.setColour(juce::Colours::white);
    g.setFont(20.0f);
    g.drawFittedText("KickRumble", getLocalBounds(), juce::Justification::centred, 1);
}

void KickRumbleAudioProcessorEditor::resized() {}
