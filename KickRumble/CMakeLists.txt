cmake_minimum_required(VERSION 3.22)
project(KickRumble VERSION 1.0.0)

# Find JUCE — either via find_package or add_subdirectory depending on your setup.
# Option A: JUCE installed system-wide or via CPM/FetchContent
# Option B: Clone JUCE into a sibling directory and uncomment the line below:
# add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../JUCE JUCE)

find_package(JUCE CONFIG REQUIRED)

juce_add_plugin(KickRumble
    COMPANY_NAME           "KickRumble"
    PLUGIN_MANUFACTURER_CODE Krmb
    PLUGIN_CODE            Krmb
    FORMATS                VST3 AU        # Build VST3 and AU targets
    PRODUCT_NAME           "KickRumble"
    IS_SYNTH               FALSE
    NEEDS_MIDI_INPUT       FALSE
    NEEDS_MIDI_OUTPUT      FALSE
    IS_MIDI_EFFECT         FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD TRUE
)

target_sources(KickRumble
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_compile_definitions(KickRumble
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(KickRumble
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
