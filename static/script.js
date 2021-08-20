class Util {
    constructor() {
        throw new Error("attempted to construct Util");
    }
    static newDiv(nam) {
        const rv = document.createElement("div");
        rv.className = nam;
        return rv;
    }
}
class FrameSongDisplay {
    constructor(app) {
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
    setTitle(title) {
        this.title.innerText = title;
    }
    setArtist(artist) {
        this.artist.innerText = artist;
    }
    setImg(url, App) {
        if (App.app.getElementsByClassName("coverart").length < 1) {
            const img = document.createElement("img");
            img.className = "coverart";
            this.imgDiv.appendChild(img);
        }
        App.app.getElementsByClassName("coverart")[0].src
            = url;
    }
}
class FrameWaveDisplay {
    constructor(app) {
        this.cv = null;
        this.waveDiv = Util.newDiv("fwd-wave");
        app.appendChild(this.waveDiv);
        return this;
    }
    // Return true if little-endian.
    isLE() {
        const ab = new ArrayBuffer(2);
        const uint8t_arr = new Uint8Array(ab);
        const uint16t_arr = new Uint16Array(ab);
        uint8t_arr[0] = 0x55;
        uint8t_arr[1] = 0xAA;
        if (uint16t_arr[0] === 0x55AA)
            return false;
        return true;
    }
    // Generate a series of bar heights.
    generateSlots(dv, width) {
        const slots = new Array();
        const nBytesPerSlot = Math.floor(dv.byteLength / width);
        const nFloatsPerSlot = Math.floor(nBytesPerSlot / 4);
        // one render per pixel
        for (let i = 0; i < width; i++) {
            let avg = 0;
            for (let j = 0; j < nFloatsPerSlot; j++) {
                const offset = Math.floor((j * 4 + i * nBytesPerSlot) / 4) * 4;
                const f = dv.getFloat32(offset, this.isLE());
                if (!Number.isNaN(f))
                    avg += f;
                else
                    console.log("WARN: generateSlots encounted a NaN");
            }
            avg /= nFloatsPerSlot;
            slots.push(avg);
        }
        return slots;
    }
    // Draw slots onto the canvas.
    drawSlots(slots) {
        this.normaliseVolume(slots);
        if (!this.cv) {
            this.cv = document.createElement("canvas");
            this.cv.className = "waveformscanvas";
            this.waveDiv.appendChild(this.cv);
            const cvBCR = this.cv.getBoundingClientRect();
            this.cv.width = cvBCR.width;
            this.cv.height = cvBCR.height;
        }
        const ctx = this.cv.getContext("2d");
        ctx.lineWidth = this.cv.width / slots.length;
        const ctxHeight = this.cv.height;
        for (let i = 0; i < slots.length; i++) {
            const height = -slots[i] * ctxHeight / 2 + ctxHeight / 2;
            ctx.beginPath();
            ctx.moveTo(i, ctxHeight / 2);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
    }
    // Increase the amplitude of the slots' samples.
    normaliseVolume(slots) {
        let max = 0;
        for (let i = 0; i < slots.length; i++) {
            if (Math.abs(slots[i]) > Math.abs(max))
                max = slots[i];
        }
        const scale = 1 / Math.abs(max);
        for (let i = 0; i < slots.length; i++)
            slots[i] *= scale;
    }
    setTrack(path) {
        return; // hack: perf issues
        fetch(path).then(resp => {
            if (resp.ok)
                return resp.arrayBuffer();
            else
                console.log("fetch error");
        }).then(buf => {
            return new AudioContext().decodeAudioData(buf);
        }).then(ab => {
            //Util.startPlayBack(ab);
            const f32 = ab.getChannelData(0);
            const dv = new DataView(f32.buffer);
            return this.generateSlots(dv, window.innerWidth);
        }).then(slots => {
            this.drawSlots(slots);
        }).catch((e) => {
            console.log("audio malfunction: ", e);
        });
    }
}
class FrameCommentsDisplay {
    constructor(App) {
        const commsDiv = Util.newDiv("fcd-comms");
        const commbarhost = App.getCommbarhost();
        commbarhost.appendChild(commsDiv);
    }
}
class Bar {
    constructor(App, fsd, fwd) {
        const bar = Util.newDiv("bar");
        const play = Util.newDiv("play");
        const ff = Util.newDiv("ff");
        const rw = Util.newDiv("rw");
        bar.appendChild(ff);
        bar.appendChild(play);
        bar.appendChild(rw);
        play.innerText = "Play";
        play.addEventListener("click", () => {
            if (Util.currTrack && Util.currTrack.filepath) {
                if (!App.audio) {
                    App.audio = new Audio(Util.currTrack.filepath);
                    App.audio.play();
                }
                else { // toggle
                    if (App.audio.paused)
                        App.audio.play();
                    else
                        App.audio.pause();
                }
            }
        });
        ff.innerText = "Fast Forward";
        ff.addEventListener("click", () => {
            App.tracks.then((tracks) => {
                if (App.tracksIndex !== -1) {
                    App.tracksIndex++;
                    if (App.tracksIndex > Object.keys(tracks).length)
                        App.tracksIndex = 1; // {1: {}, 2: {}}
                    App.populateAudio(App.tracksIndex + "", fsd, fwd);
                    //if (App.audio)  // bug ?
                    //	App.audio.pause();
                    //App.audio = new Audio(Util.currTrack.filepath);
                    //App.audio.play();
                }
            });
        });
        const commbarhost = App.getCommbarhost();
        commbarhost.appendChild(bar);
    }
}
class App {
    constructor() {
        this.commbarhost = null;
        this.audio = null;
        this.tracksIndex = -1;
        this.app = Util.newDiv("app");
        document.body.appendChild(this.app);
        const fsd = new FrameSongDisplay(this.app);
        const fwd = new FrameWaveDisplay(this.app);
        new FrameCommentsDisplay(this);
        new Bar(this, fsd, fwd);
        this.getAudio();
        this.populateAudio("1", fsd, fwd);
        //this.tracks.then(stuff => {console.log(stuff);});
    }
    getCommbarhost() {
        if (!this.commbarhost) {
            this.commbarhost = Util.newDiv("commbarhost");
            this.app.appendChild(this.commbarhost);
        }
        return this.commbarhost;
    }
    getAudio() {
        this.tracks = fetch("/private/gettracklisting").then((resp) => {
            if (resp.ok) {
                return resp.json();
            }
        });
    }
    populateAudio(id, fsd, fwd) {
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
            //}
        });
    }
}
(() => {
    new App();
})();
