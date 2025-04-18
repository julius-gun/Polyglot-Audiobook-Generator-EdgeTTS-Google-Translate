
// Helper function to filter voices based on selected language code
// selectedLangCode can be 'auto', a base code like 'en', or a specific code like 'en-US'
function filterVoices(allVoices, selectedLangCode) {
    if (selectedLangCode === 'auto') {
        return allVoices; // Show all for auto-detect (relevant for source language)
    }
    if (!selectedLangCode) {
        return []; // No language selected, show no voices
    }

    const filtered = allVoices.filter(voice => {
        const voiceLangCountry = voice.value.split(',')[0].trim(); // e.g., "en-US"
        const voiceBaseLang = voiceLangCountry.split('-')[0]; // e.g., "en"

        // Check if the selected code contains a country variant (e.g., "en-US")
        if (selectedLangCode.includes('-')) {
            // Exact match required (e.g., selected "en-US" matches only "en-US,...")
            return voiceLangCountry === selectedLangCode;
        } else {
            // Base language match (e.g., selected "en" matches "en-US,...", "en-GB,...", "en-AU,...")
            // Also handles cases where voice is just 'en' and selected is 'en'
            return voiceBaseLang === selectedLangCode;
        }
    });
    return filtered;
}

// Groups voices by the primary language code (e.g., "en" from "en-US")
function groupVoicesByLanguage(voices) {
    const grouped = {};
    voices.forEach(voice => {
        // Extract lang-COUNTRY code (e.g., "en-US")
        const langCodeCountry = voice.value.split(',')[0].trim();
        // Extract primary lang code (e.g., "en")
        const langCode = langCodeCountry.split('-')[0];
        if (!grouped[langCode]) {
            grouped[langCode] = [];
        }
        // Sort voices within a language group alphabetically by full value
        grouped[langCode].push(voice);
        grouped[langCode].sort((a, b) => a.value.localeCompare(b.value));
    });
    // Sort language groups alphabetically by language code
    const sortedGrouped = Object.keys(grouped).sort().reduce((obj, key) => {
        obj[key] = grouped[key];
        return obj;
    }, {});
    return sortedGrouped;
}


// Formats the voice option text as: Flag lang-COUNTRY, VoiceName (GenderSymbol, Attributes)
function formatVoiceOption(voice) {
    const value = voice.value; // e.g., "de-DE, FlorianMultilingualNeural"
    const gender = voice.gender; // e.g., "Male"
    const attributes = voice.attributes; // e.g., "General, Friendly, Positive"

    const parts = value.split(',').map(part => part.trim());
    const langCodeCountry = parts[0]; // e.g., "de-DE"
    const voiceName = parts[1]; // e.g., "FlorianMultilingualNeural"

    let countryFlag = '';
    const langCodeParts = langCodeCountry.split('-');
    // const langCode = langCodeParts[0]; // Not directly used in final string format
    const countryCode = langCodeParts.length > 1 ? langCodeParts[1] : null; // Handle cases like 'en' vs 'en-US'

    if (countryCode) {
        countryFlag = getFlagEmoji(countryCode);
    } else {
        // Optional: Provide a default or generic flag/icon for languages without a country code
        // countryFlag = '🏳️'; // Example: White flag
    }

    let genderSymbol = '';
    if (gender === 'Male') {
        genderSymbol = '♂';
    } else if (gender === 'Female') {
        genderSymbol = '♀';
    }
    // else: No symbol if gender is not Male or Female

    // Construct the details string part: (GenderSymbol, Attributes)
    let details = '';
    if (genderSymbol && attributes) {
        details = `(${genderSymbol}, ${attributes})`;
    } else if (genderSymbol) {
        details = `(${genderSymbol})`;
    } else if (attributes) {
        details = `(${attributes})`; // Should likely not happen based on data, but handle defensively
    }

    // Combine all parts: Flag lang-COUNTRY, VoiceName (Details)
    // Add space after flag only if flag exists
    const flagPart = countryFlag ? `${countryFlag} ` : '';
    const detailsPart = details ? ` ${details}` : ''; // Add space before details only if details exist

    return `${flagPart}${langCodeCountry}, ${voiceName}${detailsPart}`;
}


// Converts a country code (like "US") to a flag emoji
function getFlagEmoji(countryCode) {
    // Country code should be exactly 2 uppercase letters
    if (!countryCode || countryCode.length !== 2) return '';
    try {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0)); // Offset for regional indicator symbols
        return String.fromCodePoint(...codePoints);
    } catch (error) {
        console.warn(`Could not create flag for country code: ${countryCode}`, error);
        return ''; // Return empty string on error
    }
}

// Function to update a specific voice dropdown based on the selected language
function updateVoiceDropdown(dropdownElement, selectedLanguageCode) {
    if (!dropdownElement) {
        console.error("Target dropdown element not provided for voice update.");
        return;
    }
    if (typeof voicesData === 'undefined') {
        console.error("voicesData is not defined. Make sure voices-data.js is loaded.");
        dropdownElement.innerHTML = '<option disabled>Error: Voice data not loaded.</option>';
        return;
    }

    // 1. Filter voices based on the selected language
    const filteredVoices = filterVoices(voicesData, selectedLanguageCode);

    const multilingualVoices = filteredVoices
        .filter(voice => voice.value.includes('Multilingual'))
        .sort((a, b) => a.value.localeCompare(b.value)); // Sort multilingual voices alphabetically

    // 2. Group ALL filtered voices (including multilingual ones) for the main list
    const groupedFilteredVoices = groupVoicesByLanguage(filteredVoices);

    // 3. Populate the dropdown
    dropdownElement.innerHTML = ''; // Clear existing options

    if (filteredVoices.length === 0) {
        const option = document.createElement('option');
        // Provide a more informative message based on the selection
        if (!selectedLanguageCode) {
            option.textContent = `Select a language first`;
        } else if (selectedLanguageCode === 'auto') {
            // This case means voicesData is empty or filter logic failed unexpectedly
            option.textContent = `No voices available`;
            console.warn("No voices available even when 'auto' was selected.");
        }
        else {
            option.textContent = `No voices found for ${selectedLanguageCode}`;
        }
        option.disabled = true;
        dropdownElement.appendChild(option);
        return; // Stop here
    }

    if (multilingualVoices.length > 0) {
        const multiOptgroup = document.createElement('optgroup');
        multiOptgroup.label = "--- Multilingual ---";
        multilingualVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.value;
            const displayText = formatVoiceOption(voice);
            option.textContent = displayText;
            multiOptgroup.appendChild(option);
        });
        dropdownElement.appendChild(multiOptgroup);
    }


    // --- START: Add Regular Language Optgroups ---
    // Iterate over grouped voices and create optgroups and options
    const sortedLanguageCodes = Object.keys(groupedFilteredVoices).sort();

    sortedLanguageCodes.forEach(languageCode => {
        const languageVoices = groupedFilteredVoices[languageCode];
        const optgroup = document.createElement('optgroup');
        // Use language name from map or fallback to uppercase code
        // Add a separator label based on whether a multilingual group was added
        const separator = multilingualVoices.length > 0 ? "--- " : "";
        optgroup.label = `${separator}${languageNames[languageCode] || languageCode.toUpperCase()}`;
        dropdownElement.appendChild(optgroup);

        // Voices within the group are already sorted by groupVoicesByLanguage
        languageVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.value; // Store the original value
            const displayText = formatVoiceOption(voice);
            option.textContent = displayText;
            optgroup.appendChild(option);
        });
    });

    // Optional: Automatically select the first voice if available?
    if (dropdownElement.options.length > 0) {
        // Maybe select the first *non-multilingual* option by default? Or just the very first?
        dropdownElement.selectedIndex = 0; // Selects the first overall (could be multilingual)
    }
}

// Note: The old populateVoiceDropdowns function is removed.
// The call to populate dropdowns will now happen in main.js during initialization and on language change.