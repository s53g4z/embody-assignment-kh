# embody-assignment-kh

## Instructions

Execute
```
flask run
```
in the project directory and check `127.0.0.1:5000` in a web browser for the webapp.

Additional audio tracks can be added to the `static/assets/` directory and manually registered with the `tracks1` table in the `db` SQLite database file. `img/` contains optional cover art for the audio tracks.

## Design Details

### Coding Languages Used
The server configuration is written in Python using the Flask framework. The webapp mostly consists of compiled TypeScript and CSS. The database providing the backing storage is SQLite.

Flask was chosen for its ease of use, secure defaults, and ability to integrate well with sqlite3 for Python. CSS was determined to be adequate for styling the webapp, and TypeScript was chosen over plain JavaScript for its enhanced error-checking capabilities. The SQLite database was chosen since the data needed to be stored fits well in table format and because of programmer familiarity.

### Known Bugs
- The timestamped comment implementation may not meet expectations because it is based on a specification that can be read in multiple ways.
- The displayed waveform may be inaccurate because the backing calculations were crafted from scratch without any pro-audio background.
- The displayed waveform calculation is computationally-intensive, although the rest of the webapp should still be responsive while the computations occur.
- Memory usage is high (?). The only manual optimizations made to the the codebase are caching mechanisms for the waveform display and audio files and the result of host-endianness determination, as guided by browser profiling.
