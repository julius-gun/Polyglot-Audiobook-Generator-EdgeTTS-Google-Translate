﻿const text = document.querySelector('.text')
const pitch = document.querySelector('.pitch')
const pitch_str = document.querySelector('#pitch-str')
const rate = document.querySelector('.rate')
const rate_str = document.querySelector('#rate-str')
const max_threads = document.querySelector('.max-threads')
const max_threads_int = document.querySelector('#max-threads-int')
const mergefiles = document.querySelector('.mergefiles')
const mergefiles_str = document.querySelector('#mergefiles-str')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const settingsButton = document.querySelector('.settingsbutton')
const pointsSelect = document.querySelector('.pointsselect')
const pointsType = document.querySelector('.pointstype')
const textArea = document.getElementById('text-area')
const statArea = document.getElementById('stat-area')
const stat_info = document.querySelector('#stat-info')
const stat_str = document.querySelector('#stat-str')
const fileInput = document.getElementById('file-input')
const fileButton = document.getElementById('file-button')
const dopSettings = document.getElementById('dop-settings-label')
const periodReplacementOptions = document.getElementById('period-replacement-options');
const rateSliderDiv = document.getElementById('div-rate');
const pitchSliderDiv = document.getElementById('div-pitch');
const threadsSliderDiv = document.getElementById('div-threads');
const mergeFilesSliderDiv = document.getElementById('div-mergefiles');


// Progress bar elements
const progressBar = document.getElementById('progress-bar');
const progressStr = document.getElementById('progress-str');
const timeLeftStr = document.getElementById('time-left-str');
// Progress labels elements
const progressLabel = document.getElementById('progress-label');
const timeLeftLabel = document.getElementById('time-left-label');
// Progress container
const progressContainer = document.querySelector('.progress-container');

// Help system
const helpSection = document.querySelector('.help-section');
const helpTitle = document.getElementById('help-title');
const helpText = document.getElementById('help-text');

function showHelp(title, text) {
	helpTitle.textContent = title;
	helpText.textContent = text;
	helpSection.classList.add('show');
}

function hideHelp() {
	helpSection.classList.remove('show');
}

// Add help text for period replacement modes
document.getElementById('pointstype').addEventListener('click', () => {
	const mode = document.getElementById('pointstype').textContent;
	const helpTexts = {
		'V1': 'Replaces all periods in the text with the selected character.',
		'V2': 'Preserves periods at line endings, but replaces all other periods with the selected character.',
		'V3': 'Preserves periods at line endings, and replaces only periods followed by spaces with the selected character plus a space.'
	};
	showHelp('Period Replacement Mode: ' + mode, helpTexts[mode]);
});

// Hide help when clicking outside
document.addEventListener('click', (e) => {
	if (!e.target.closest('.help-section') &&
		!e.target.closest('#pointstype')) {
		hideHelp();
	}
});

saveButton.addEventListener('click', e => start())
//save_alloneButton.addEventListener('click', e => start_allone())
settingsButton.addEventListener('click', e => lite_mod())
rate.addEventListener('input', e => rate_str.textContent = rate.value >= 0 ? `+${rate.value}%` : `${rate.value}%`)
pitch.addEventListener('input', e => pitch_str.textContent = pitch.value >= 0 ? `+${pitch.value}Hz` : `${pitch.value}Hz`)
max_threads.addEventListener('input', e => max_threads_int.textContent = max_threads.value)
mergefiles.addEventListener('input', e => mergefiles_str.textContent = mergefiles.value == 100 ? "ALL" : `${mergefiles.value} pcs.`)
window.addEventListener('beforeunload', function (event) { save_settings() });


stat_info.addEventListener('click', () => {
	if (textArea.style.display == 'none') {
		statArea.style.display = (statArea.style.display == 'none') ? 'block' : 'none';
	}
});

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 3200
var book
var book_loaded = false

var parts_book = []
var file_name_ind = 0
var num_book = 0
var num_text = 0
var fix_num_book = 0
var threads_info = { count: parseInt(max_threads.value), stat: stat_str }
var run_work = false
var save_path_handle
var settingsVisible = false; // Track settings visibility

document.addEventListener("DOMContentLoaded", function (event) {
	load_settings()
	// Initially hide progress bar, time left text and labels
	progressBar.style.display = 'none';
	progressStr.style.display = 'none';
	timeLeftStr.style.display = 'none';
	progressLabel.style.display = 'none';
	timeLeftLabel.style.display = 'none';
	progressContainer.style.display = 'none';

})

fileButton.addEventListener('click', () => {
	fileInput.click();
})




fileInput.addEventListener('change', (event) => {
	run_work = false
	book_loaded = false
	statArea.value = ""

	if (book) {
		book.clear()
		book = null
	}

	if (event.target.files.length == 0) {
		fileButton.textContent = "Insert Text File"
		stat_info.textContent = ""//"Open"
	}

	for (let file of event.target.files) {
		stat_info.textContent = ""
		stat_str.textContent = "0 / 0"

		if (file) {
			fileButton.textContent = "Processing..."
			const reader = new FileReader()
			reader.onload = () => {
				book_loaded = true
				const file_name_toLowerCase = file.name.toLowerCase()

				if (file_name_toLowerCase.endsWith('.txt')) {
					get_text(file.name.slice(0, file.name.lastIndexOf(".")), reader.result, true)
				} else if (file_name_toLowerCase.endsWith('.ini')) {
					get_text(file.name.slice(0, file.name.lastIndexOf(".")), reader.result, true)
				} else if (file_name_toLowerCase.endsWith('.fb2')) {
					get_text(file.name.slice(0, file.name.lastIndexOf(".")), convertFb2ToTxt(reader.result), true)
				} else if (file_name_toLowerCase.endsWith('.epub')) {
					convertEpubToTxt(file).then(result => get_text(file.name.slice(0, file.name.lastIndexOf(".")), result, true))
				} else if (file_name_toLowerCase.endsWith('.zip')) {
					convertZipToTxt(file)
				}
				fileButton.textContent = "Opened"
			}

			reader.readAsText(file)
		} else {
			fileButton.textContent = "Insert Text File"
		}
	}

})

function lite_mod() {
	settingsVisible = !settingsVisible; // Toggle settings visibility

	periodReplacementOptions.classList.toggle('hidden-option', !settingsVisible);
	rateSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	pitchSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	threadsSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	mergeFilesSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	dopSettings.classList.toggle('hidden-option', !settingsVisible);
	document.querySelector('.options').classList.toggle('optionslite', !settingsVisible);


	const display_str = 'block' // Always show text area
	textArea.style.display = display_str;
	statArea.style.display = display_str;


	if (book && book.all_sentences.length > 0) {
		textArea.value = ""
	}

	if (display_str == 'none') { // This condition will never be true now, but kept for structure
		dopSettings.style.display = 'block'
	} else {
		dopSettings.style.display = 'none'


		if (book && book.all_sentences.length > 0) {
			let tmp_ind = 0
			for (let part of book.all_sentences) {
				tmp_ind += 1
				textArea.value += "Part " + tmp_ind + ":\n" + part + "\n\n"
			}
		}

	}
}

function get_text(_filename, _text, is_file) {
	statArea.value = ""
	if (is_file == true) {
		textArea.value = ""
	}

	if (book && is_file) {
		book.addNewText(_filename, _text)
	} else {
		if (book) {
			book.clear()
			book = null
		}

		book = new ProcessingFile(
			_filename,
			_text,
			FIRST_STRINGS_SIZE,
			LAST_STRINGS_SIZE
		)
	}

	let tmp_ind = 0
	for (let part of book.all_sentences) {
		tmp_ind += 1
		if (is_file == true && textArea.style.display != 'none') {
			textArea.value += "Part " + tmp_ind + ":\n" + part + "\n\n"
		}
		statArea.value += "Part " + (tmp_ind).toString().padStart(4, '0') + ": Opened\n"
	}
	stat_info.textContent = ""//"Open"
	stat_str.textContent = `0 / ${book.all_sentences.length}`

	//Очистка ранее запущенной обработки
	clear_old_run()
}

function clear_old_run() {
	if (parts_book) {
		for (let part of parts_book) {
			if (part) part.clear()
		}
	}
	parts_book = []
	file_name_ind = 0
	num_book = 0
	fix_num_book = 0
	threads_info = { count: parseInt(max_threads.value), stat: stat_str }
	// Reset progress bar and time
	progressBar.value = 0;
	progressStr.textContent = '0%';
	timeLeftStr.textContent = 'Calculating...';
}

function add_edge_tts(merge) {
	if (run_work == true) {
		if (book && num_book < threads_info.count) {
			let file_name = book.file_names[file_name_ind][0]
			let timerId = setTimeout(function tick() {
				if (threads_info.count < parseInt(max_threads.value)) {
					threads_info.count = parseInt(max_threads.value)
				}
				if (num_book < threads_info.count && num_book < book.all_sentences.length) {
					if (book.file_names[file_name_ind][1] > 0 && book.file_names[file_name_ind][1] <= num_book) {
						file_name_ind += 1
						file_name = book.file_names[file_name_ind][0]
						fix_num_book = num_book
					}

					parts_book.push(
						new SocketEdgeTTS(
							num_book,
							file_name,// + " " +
							(num_book + 1 - fix_num_book).toString().padStart(4, '0'),
							"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
							String(pitch_str.textContent),
							rate_str.textContent,
							"+0%",
							book.all_sentences[num_book],
							statArea,
							threads_info,
							merge,
							updateProgress
						)
					)
					num_book += 1
				}
				// Recursive call to add more threads if needed
				add_edge_tts(merge);
			}, 100)
		}
		if (merge) do_marge()
	}
}

function get_audio() {
	clear_old_run()
	run_work = true
	stat_info.textContent = "Processed"
	const stat_count = stat_str.textContent.split(' / ');
	stat_str.textContent = "0 / " + stat_count[1]
	const merge = (mergefiles.value == 1) ? false : true;

	if (!book_loaded) {
		num_text += 1
		get_text("Text " + (num_text).toString().padStart(4, '0'), textArea.value, false)
	}

	// Initialize progress bar and timer
	progressBar.max = book.all_sentences.length;
	progressBar.value = 0;
	progressStr.textContent = '0%';
	startTime = Date.now();
	estimatedTimePerPart = null;
	timeLeftStr.textContent = 'Calculating...';

	add_edge_tts(merge)
}

function updateProgress(index) {
	const processedParts = index + 1;
	const totalParts = book.all_sentences.length;
	const progressPercent = (processedParts / totalParts) * 100;
	progressBar.value = processedParts;
	progressStr.textContent = `${progressPercent.toFixed(1)}%`;

	// Estimate time left
	const currentTime = Date.now();
	const elapsedTime = currentTime - startTime;

	if (!estimatedTimePerPart && processedParts > 0) {
		estimatedTimePerPart = elapsedTime / processedParts;
	}

	if (estimatedTimePerPart) {
		const timeLeftMilliseconds = estimatedTimePerPart * (totalParts - processedParts);
		const timeLeftSeconds = Math.ceil(timeLeftMilliseconds / 1000);
		const timeLeftMinutes = Math.floor(timeLeftSeconds / 60);
		const remainingSeconds = timeLeftSeconds % 60;
		timeLeftStr.textContent = `${timeLeftMinutes} min ${remainingSeconds} sec`;
	}
}


async function saveFiles(fix_filename, blob, from_ind, to_ind) {
	const new_folder_handle = await save_path_handle.getDirectoryHandle(parts_book[from_ind].my_filename, { create: true });
	const fileHandle = await new_folder_handle.getFileHandle(fix_filename, { create: true });
	const writableStream = await fileHandle.createWritable();
	const writable = writableStream.getWriter();
	await writable.write(blob);
	await writable.close();

	for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
		parts_book[ind_mp3].clear()
	}
}

function save_merge(num_mp3, from_ind, to_ind, mp3_length) {
	if (parts_book[from_ind].start_save == false) {
		parts_book[from_ind].start_save = true
		const combinedUint8Array = new Uint8Array(mp3_length)
		let pos = 0

		for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
			combinedUint8Array.set(parts_book[ind_mp3].my_uint8Array, pos)
			pos += parts_book[ind_mp3].my_uint8Array.length
		}

		var blob_mp3 = new Blob([combinedUint8Array.buffer])
		var fix_filename = "file.mp3"
		if (num_mp3 == 1 && to_ind < parts_book.length - 1 && parts_book[to_ind].my_filename != parts_book[to_ind + 1].my_filename) {
			fix_filename = parts_book[from_ind].my_filename + '.mp3'
		} else
			if (mergefiles.value < 100 && mergefiles.value < parts_book.length) {
				fix_filename = parts_book[from_ind].my_filename + " " + (num_mp3).toString().padStart(4, '0') + '.mp3'
			} else {
				fix_filename = parts_book[from_ind].my_filename + '.mp3'
			}

		if (save_path_handle ?? false) {
			saveFiles(fix_filename, blob_mp3, from_ind, to_ind)
		} else {
			const url = window.URL.createObjectURL(blob_mp3)
			const link = document.createElement('a')
			link.href = url
			link.download = fix_filename
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			window.URL.revokeObjectURL(url)

			for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
				parts_book[ind_mp3].clear()
			}
		}
		// Hide progress bar and time left text and display "Operation finished"
		progressBar.style.display = 'none';
		progressStr.style.display = 'none';
		timeLeftStr.style.display = 'none';
		progressLabel.style.display = 'none';
		timeLeftLabel.style.display = 'none';
		progressContainer.style.display = 'none';
		stat_info.textContent = "Operation finished";
	}
}

function do_marge() {
	let save_part = false
	let count_mergefiles = parseInt(mergefiles.value)
	if (count_mergefiles >= 100) {
		count_mergefiles = book.all_sentences.length
	}

	var books_map = []
	var sav_ind = true
	var last_ind = 0
	var part_mp3_length = 0
	var count_mp3 = 0
	var num_mp3 = 1
	let names_map = book.file_names.map(item => item[1])
	for (let ind = 0; ind < book.all_sentences.length; ind++) {

		if (parts_book && ind < parts_book.length && parts_book[ind].mp3_saved == true) {
			if (sav_ind == true) {
				part_mp3_length += parts_book[ind].my_uint8Array.length
			}
		} else {
			sav_ind = false
			part_mp3_length = 0
		}

		if (count_mp3 >= count_mergefiles - 1 || ind == book.all_sentences.length - 1 || names_map.includes(ind + 1)) {
			books_map.push([sav_ind, last_ind, ind, part_mp3_length, num_mp3])
			sav_ind = true
			last_ind = ind + 1
			part_mp3_length = 0
			count_mp3 = 0
			if (names_map.includes(ind + 1)) {
				num_mp3 = 1
			} else {
				num_mp3 += 1
			}
		} else {
			count_mp3 += 1
		}
	}

	if (books_map.length > 0) {
		for (let book_map of books_map) {
			if (book_map[0] == true && book_map[3] > 0) {
				save_merge(book_map[4], book_map[1], book_map[2], book_map[3])
			}
		}
	}
}

async function selectDirectory() {
	try {
		save_path_handle = await window.showDirectoryPicker()
		const fileHandle = await save_path_handle.getFileHandle('temp.txt', { create: true })
		const writable = await fileHandle.createWritable()
		await writable.close()
		await fileHandle.remove()
		get_audio()
	} catch (err) {
		console.log('err', err);
		save_path_handle = null
		get_audio()
	}
}

const start = () => {
	save_settings()

	if (textArea.value.trim() === "") {
		return; // Stop execution if no text
	}

	// Show progress bar and time left text when save starts
	progressBar.style.display = 'block';
	progressStr.style.display = 'block';
	timeLeftStr.style.display = 'block';
	progressContainer.style.display = 'block';
	selectDirectory()
}


function points_mod() {
	if (pointsType.innerHTML === "V1") {
		pointsType.innerHTML = "V2";
	} else if (pointsType.innerHTML === "V2") {
		pointsType.innerHTML = "V3";
	} else if (pointsType.innerHTML === "V3") {
		pointsType.innerHTML = "V1";
	}
}

function save_settings() {
	localStorage.setItem('pointsSelect_value', pointsSelect.value)
	localStorage.setItem('pointsType_innerHTML', pointsType.innerHTML)
	localStorage.setItem('voice_value', voice.value)
	localStorage.setItem('rate_value', rate.value)
	localStorage.setItem('pitch_value', pitch.value)
	localStorage.setItem('max_threads_value', max_threads.value)
	localStorage.setItem('mergefiles_value', mergefiles.value)
	localStorage.setItem('rate_str_textContent', rate_str.textContent)
	localStorage.setItem('pitch_str_textContent', pitch_str.textContent)
	localStorage.setItem('max_threads_int_textContent', max_threads_int.textContent)
	localStorage.setItem('mergefiles_str_textContent', mergefiles_str.textContent)
	localStorage.setItem('statArea_style_display', statArea.style.display)
	localStorage.setItem('settingsVisible', settingsVisible) // Save visibility state
}

function load_settings() {
	if (localStorage.getItem('pointsSelect_value')) { pointsSelect.value = localStorage.getItem('pointsSelect_value') }
	if (localStorage.getItem('pointsType_innerHTML')) { pointsType.innerHTML = localStorage.getItem('pointsType_innerHTML') }
	if (localStorage.getItem('voice_value')) { voice.value = localStorage.getItem('voice_value') }
	if (localStorage.getItem('rate_value')) { rate.value = localStorage.getItem('rate_value') }
	if (localStorage.getItem('pitch_value')) { pitch.value = localStorage.getItem('pitch_value') }
	if (localStorage.getItem('max_threads_value')) { max_threads.value = localStorage.getItem('max_threads_value') }
	if (localStorage.getItem('mergefiles_value')) { mergefiles.value = localStorage.getItem('mergefiles_value') }
	if (localStorage.getItem('rate_str_textContent')) { rate_str.textContent = localStorage.getItem('rate_str_textContent') }
	if (localStorage.getItem('pitch_str_textContent')) { pitch_str.textContent = localStorage.getItem('pitch_str_textContent') }
	if (localStorage.getItem('max_threads_int_textContent')) { max_threads_int.textContent = localStorage.getItem('max_threads_int_textContent') }
	if (localStorage.getItem('mergefiles_str_textContent')) { mergefiles_str.textContent = localStorage.getItem('mergefiles_str_textContent') }
	if (localStorage.getItem('statArea_style_display')) { statArea.style.display = localStorage.getItem('statArea_style_display') }
	if (localStorage.getItem('settingsVisible')) { settingsVisible = localStorage.getItem('settingsVisible') === 'true'; } // Load visibility state

	threads_info = { count: parseInt(max_threads.value), stat: stat_str }

	// Set initial visibility based on loaded settings
	periodReplacementOptions.classList.toggle('hidden-option', !settingsVisible);
	rateSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	pitchSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	threadsSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	mergeFilesSliderDiv.classList.toggle('hidden-option', !settingsVisible);
	dopSettings.classList.toggle('hidden-option', !settingsVisible);
	document.querySelector('.options').classList.toggle('optionslite', !settingsVisible);
}
