#pragma once

#include "PluginProcessor.h"

//==============================================================================
// Minimal editor — delegates to GenericAudioProcessorEditor for now.
// A custom UI will be designed later.
//==============================================================================
class KickRumbleAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit KickRumbleAudioProcessorEditor(KickRumbleAudioProcessor&);
    ~KickRumbleAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    KickRumbleAudioProcessor& processorRef;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(KickRumbleAudioProcessorEditor)
};
