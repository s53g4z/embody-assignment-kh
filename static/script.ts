class Util {
	static currTrack: {
		artist: string,
		filepath: string,
		nam: string,
		picpath: string
	};
	constructor() {
		throw new Error("attempted to construct Util");
	}
	static newDiv(nam: string) {
		const ret = document.createElement("div");
		ret.className = nam;
		return ret;
	}
}

class FrameSongDisplay {
	fsd: HTMLDivElement;
	title: HTMLDivElement;
	artist: HTMLDivElement;
	imgDiv: HTMLDivElement;
	setTitle(title: string) {
		this.title.innerText = title;
	}
	setArtist(artist: string) {
		this.artist.innerText = artist;
	}
	setImg(url: string, App: App) {
		if (App.app.getElementsByClassName("coverart").length < 1) {
			const img = document.createElement("img");
			img.className = "coverart"
			this.imgDiv.appendChild(img);
		}
		(App.app.getElementsByClassName("coverart")[0] as HTMLImageElement).src
			= url;
	}
	constructor(app: HTMLDivElement) {
		this.fsd = Util.newDiv("fsd");
		app.appendChild(this.fsd);
		this.title = Util.newDiv("fsd-title");
		this.fsd.appendChild(this.title);
		this.artist = Util.newDiv("fsd-artist");
		this.fsd.appendChild(this.artist);
		this.imgDiv = Util.newDiv("fsd-img");
		this.fsd.appendChild(this.imgDiv);
		return this;
	}
}

class FrameWaveDisplay {
	App: App;
	waveDiv: HTMLDivElement;
	cv: HTMLCanvasElement;
	
	// Helper fn that returns true if host is little-endian.
	isLE(): boolean {
		const ab = new ArrayBuffer(2);
		const uint8t_arr = new Uint8Array(ab);
		const uint16t_arr = new Uint16Array(ab);
		uint8t_arr[0] = 0x55;
		uint8t_arr[1] = 0xAA;
		if (uint16t_arr[0] === 0x55AA)
			return false;
		return true;
	}
	// Helper fn to generate a series of bar heights.
	generateSlots(dv: DataView, width: number) {
		const isLE = this.isLE();
		const slots = new Array();
		const nBytesPerSlot = Math.floor(dv.byteLength / width);
		const nFloatsPerSlot = Math.floor(nBytesPerSlot / 4);
		// one render per pixel
		for (let i = 0; i < width; i++) {
			let avg = 0;
			for (let j = 0; j < nFloatsPerSlot; j++) {
				const offset = Math.floor((j * 4 + i * nBytesPerSlot) / 4) * 4;
				const f = dv.getFloat32(offset, isLE);
				avg += f;
			}
			avg /= nFloatsPerSlot;
			slots.push(avg);
		}
		return slots;
	}
	// Helper fn to draw slots onto the canvas.
	drawSlots(slots: Array<number>): void {
		this.normaliseVolume(slots);
		
		const ctx = this.cv.getContext("2d");
		ctx.clearRect(0, 0, this.cv.width, this.cv.height);
		ctx.lineWidth = this.cv.width / slots.length;
		ctx.strokeStyle = "#ff0000ff";
		const ctxHeight = this.cv.height;
		for (let i = 0; i < slots.length; i++) {
			const height = -slots[i] * ctxHeight / 2 + ctxHeight / 2;
			ctx.beginPath();
			ctx.moveTo(i, ctxHeight / 2);
			ctx.lineTo(i, height);
			ctx.stroke();
		}
	}
	// Helper fn to increase the amplitude of the slots' samples.
	normaliseVolume(slots: Array<number>): void {
		let max = 0;
		for (let i = 0; i < slots.length; i++) {
			if (Math.abs(slots[i]) > Math.abs(max))
				max = slots[i];
		}
		const scale = 1 / Math.abs(max);
		for (let i = 0; i < slots.length; i++)
			slots[i] *= scale;
	}
	setTrack(path: string): void {
		fetch(path).then(resp => {
			if (resp.ok)
				return resp.arrayBuffer();
			else
				console.log("fetch error");
		}).then(buf => {
			return new AudioContext().decodeAudioData(buf);
		}).then(ab => {  // AudioBuffer
			const f32 = ab.getChannelData(0);
			const dv = new DataView(f32.buffer);
			return this.generateSlots(dv, window.innerWidth);
		}).then(slots => {
			this.drawSlots(slots);
		}).catch((e) => {
			console.log("audio malfunction: ", e);
		});
	}
	// Helper for constructor to add an event listener to canvas.
	addEventListenersToCanvas(): void {
		this.cv.addEventListener("click", (e) => {
			const cvBCR = this.cv.getBoundingClientRect();
			const cx = e.clientX - cvBCR.left;
			const cy = e.clientY - cvBCR.top;
			const frac = cx / cvBCR.width * this.App.audio.duration;
			this.App.audio.currentTime = frac;
			this.App.audio.play();
			
			const plays = this.App.app.getElementsByClassName("play");
			if (plays.length === 1) {
				const play = <HTMLDivElement> plays[0];
				play.innerText = "Pause";
			}
		});
	}
	constructor(App: App) {
		this.App = App;
		this.waveDiv = Util.newDiv("fwd-wave");
		this.App.app.appendChild(this.waveDiv);
		
		this.cv = document.createElement("canvas");
		this.cv.className = "waveformscanvas";
		this.waveDiv.appendChild(this.cv);
		const cvBCR = this.cv.getBoundingClientRect();
		this.cv.width = cvBCR.width;
		this.cv.height = cvBCR.height;
		
		this.addEventListenersToCanvas();
		
		return this;
	}
}

class FrameCommentsDisplay {
	commsDiv: HTMLDivElement;
	populateSelf(): void {
		// todo
	}
	constructor(App: App) {
		this.commsDiv = Util.newDiv("fcd-comms");
		const commbarhost = App.getCommbarhost();
		commbarhost.appendChild(this.commsDiv);
		
		this.populateSelf();
	}
}

class Bar {
	// Helper for constructor to add event listeners to bar buttons.
	addEventListeners(App: App, play: HTMLDivElement, ff: HTMLDivElement,
		rw: HTMLDivElement, fsd: FrameSongDisplay, fwd: FrameWaveDisplay) {
		play.innerText = "Play"
		play.addEventListener("click", () => {
			if (Util.currTrack && Util.currTrack.filepath) {
				if (!App.audio) {
					App.audio = new Audio(Util.currTrack.filepath);
					App.audio.play();
				} else {  // toggle
					if (App.audio.paused) {
						App.audio.play();
						play.innerText = "Pause";
					} else {
						App.audio.pause();
						play.innerText = "Play";
					}
				}
			}
		});
		ff.innerText = "Fast Forward"
		ff.addEventListener("click", () => {
			App.tracks.then((tracks) => {
				if (App.tracksIndex !== -1) {
					App.tracksIndex++;
					if (App.tracksIndex > Object.keys(tracks).length)
						App.tracksIndex = 1;  // {1: {}, 2: {}}
					App.populateAudio(App.tracksIndex + "", fsd, fwd);
					play.innerText = "Pause";
				}
			});
		});
		rw.innerText = "Rewind";
		rw.addEventListener("click", () => {
			App.tracks.then((tracks) => {
				if (App.tracksIndex !== -1) {
					App.tracksIndex--;
					if (App.tracksIndex <= 0)
						App.tracksIndex = Object.keys(tracks).length;
					App.populateAudio(App.tracksIndex + "", fsd, fwd);
					play.innerText = "Pause";
				}
			});
		});
	}
	constructor(App: App, fsd: FrameSongDisplay, fwd: FrameWaveDisplay) {
		const bar = Util.newDiv("bar");
		const play = Util.newDiv("play");
		const ff = Util.newDiv("ff");
		const rw = Util.newDiv("rw");
		bar.appendChild(ff);
		bar.appendChild(play);
		bar.appendChild(rw);
		this.addEventListeners(App, play, ff, rw, fsd, fwd);
		
		const commbarhost = App.getCommbarhost();
		commbarhost.appendChild(bar);
	}
}

class App {
	app: HTMLDivElement;
	audio: HTMLAudioElement;
	watcherID: number;
	commbarhost: HTMLDivElement;  // hosting div for comments and play/pause bar
	tracks: Promise<{
		[track: string]: {
			artist: string,
			filepath: string,
			nam: string,
			picpath: string
		}
	}>;
	tracksIndex: number;
	getCommbarhost(): HTMLDivElement {
		if (!this.commbarhost) {
			this.commbarhost = Util.newDiv("commbarhost");
			this.app.appendChild(this.commbarhost);
		}
		return this.commbarhost;
	}
	getAudio(): void {
		this.tracks = fetch("/private/gettracklisting").then((resp) => {
			if (resp.ok) {
				return resp.json();
			}
		});
	}
	// Helper for setupWatcher to find the shadow element.
	getShadow(fwd: FrameWaveDisplay): HTMLDivElement {
		const shadows = this.app.getElementsByClassName("shadow");
		let shadow = null;
		if (shadows.length < 1) {
			shadow = Util.newDiv("shadow");
			shadow.style.position = "absolute";
			shadow.style.backgroundColor = "rgba(255, 160, 0, 0.5)";
			fwd.waveDiv.appendChild(shadow);
		} else
			shadow = shadows[0];
		return shadow;
	}
	setupWatcher(fwd: FrameWaveDisplay): void {
		const shadow = this.getShadow(fwd);
		clearInterval(this.watcherID);
		this.watcherID = setInterval(() => {
			const currTime = this.audio.currentTime;
			const duration = this.audio.duration;
			const frac = currTime / duration;
			
			const cvs = this.app.getElementsByClassName("waveformscanvas");
			if (cvs.length === 1) {
				const cv = cvs[0];
				const cvBCR = cv.getBoundingClientRect();
				const width = frac * cvBCR.width;
				const nx = cvBCR.left + window.scrollX;
				const ny = cvBCR.top + window.scrollY;
				const height = cvBCR.height;
				
				shadow.style.left = nx + "px";
				shadow.style.top = ny + "px";
				shadow.style.height = height + "px";
				shadow.style.width = width + "px";
			}
		}, 100);
	}
	populateAudio(id: string,
		fsd: FrameSongDisplay, fwd: FrameWaveDisplay): void {
		if (this.audio)
			this.audio.pause();
		this.tracks.then((tracks) => {
			this.tracksIndex = parseInt(id);
			Util.currTrack = tracks[id];
			const track = tracks[id];
			fsd.setTitle(track.nam);
			fsd.setArtist(track.artist);
			fsd.setImg(track.picpath, this);
			fwd.setTrack(track.filepath);
			if (!this.audio)
				this.audio = new Audio(track.filepath);
			else
				this.audio.src = track.filepath;
			this.audio.play();
			this.setupWatcher(fwd);
		});
		
	}
	constructor() {
		this.commbarhost = null;
		this.audio = null;
		this.tracksIndex = -1;
		this.app = Util.newDiv("app");
		document.body.appendChild(this.app);
		const fsd = new FrameSongDisplay(this.app);
		const fwd = new FrameWaveDisplay(this);
		new FrameCommentsDisplay(this);
		new Bar(this, fsd, fwd);
		
		this.getAudio();
		this.populateAudio("1", fsd, fwd);
	}
}

(() => {
	new App();
})();
