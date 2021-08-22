class Util {
    constructor() {
        throw new Error("attempted to construct Util");
    }
    static newDiv(nam) {
        const ret = document.createElement("div");
        ret.className = nam;
        return ret;
    }
    static formatToTwoDigits(n) {
        if (n < 0)
            throw new Error("tried to parse unsupported number");
        else if (n < 10)
            return "0" + n;
        else
            return "" + n;
    }
    // Helper for constructor to convert seconds to HMS. .toTimeString(), really
    static getHMS(timestamp) {
        if (timestamp < 0)
            throw new Error("negative timestamps unsupported");
        Math.round(timestamp);
        let hours = Math.floor(timestamp / 3600);
        timestamp = timestamp % 3600;
        let minutes = Math.floor(timestamp / 60);
        timestamp = timestamp % 60;
        let seconds = Math.floor(timestamp);
        let strHours = (hours < 10 ? "0" : "") + hours;
        let strMinutes = (minutes < 10 ? "0" : "") + minutes;
        let strSeconds = (seconds < 10 ? "0" : "") + seconds;
        return strHours + ":" + strMinutes + ":" + strSeconds;
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
    constructor(App) {
        this.App = App;
        this.wfCache = new Array();
        this.waveDiv = Util.newDiv("fwd-wave");
        this.App.app.appendChild(this.waveDiv);
        return this;
    }
    // Helper fn that returns true if host is little-endian.
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
    // Helper fn to generate a series of bar heights.
    generateSlots(dv, width) {
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
    drawSlots(slots, id, cv) {
        this.normaliseVolume(slots);
        const ctx = cv.getContext("2d");
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.lineWidth = cv.width / slots.length;
        ctx.strokeStyle = "#ff0000ff";
        const ctxHeight = cv.height;
        for (let i = 0; i < slots.length; i++) {
            const height = -slots[i] * ctxHeight / 2 + ctxHeight / 2;
            ctx.beginPath();
            ctx.moveTo(i, ctxHeight / 2);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        //this.wfCache[id] = cv;
    }
    // Helper fn to increase the amplitude of the slots' samples.
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
    setTrack(path, idstr) {
        const id = parseInt(idstr, 10);
        this.detachCurrentCV();
        if (this.wfCache[id] !== undefined) {
            this.attachCV(this.wfCache[id]);
            return;
        }
        this.createCV();
        this.wfCache[id] = this.cv;
        fetch(path).then(resp => {
            if (resp.ok)
                return resp.arrayBuffer();
            else
                console.log("fetch error");
        }).then(buf => {
            return new AudioContext().decodeAudioData(buf);
        }).then(ab => {
            const f32 = ab.getChannelData(0);
            const dv = new DataView(f32.buffer);
            return this.generateSlots(dv, window.innerWidth);
        }).then(slots => {
            this.drawSlots(slots, id, this.wfCache[id]);
            //this.wfCache[id] = this.cv;
        }).catch((e) => {
            console.log("audio malfunction: ", e);
        });
    }
    // Helper for constructor to add an event listener to canvas.
    addEventListenersToCanvas() {
        this.cv.addEventListener("click", (e) => {
            const cvBCR = this.cv.getBoundingClientRect();
            const cx = e.clientX - cvBCR.left;
            const cy = e.clientY - cvBCR.top;
            const frac = cx / cvBCR.width * this.App.audio.duration;
            this.App.audio.currentTime = frac;
            this.App.audio.play();
            const plays = this.App.app.getElementsByClassName("play");
            if (plays.length === 1) {
                const play = plays[0];
                play.innerText = "Pause";
            }
        });
    }
    // Detach this.cv from this.cv and the DOM.
    detachCurrentCV() {
        if (this.cv) {
            this.cv.parentNode.removeChild(this.cv);
            this.cv = null;
        }
    }
    // Attach cv to this.cv and the DOM.
    attachCV(cv) {
        this.cv = cv;
        this.waveDiv.appendChild(this.cv);
    }
    // Create a <canvas> out of thin air, and attach it to this.cv.
    createCV() {
        this.cv = document.createElement("canvas");
        this.cv.className = "waveformscanvas";
        this.attachCV(this.cv);
        const cvBCR = this.cv.getBoundingClientRect();
        this.cv.width = cvBCR.width;
        this.cv.height = cvBCR.height;
        this.addEventListenersToCanvas();
    }
}
class UserComment {
    constructor(fcd, nam, comment, timestamp, appendNow) {
        const hms = Util.getHMS(timestamp);
        const uc = Util.newDiv("usercomment");
        const nameElem = Util.newDiv("aName");
        const commentElem = Util.newDiv("aComment");
        const hmsElem = Util.newDiv("aHMS");
        const origTS = Util.newDiv("aOrigTS");
        nameElem.innerText = nam;
        if (comment.length > 1000) // truncate longer comments
            comment = comment.substring(0, 1000 - 3) + "...";
        commentElem.innerText = comment;
        hmsElem.innerText = hms;
        origTS.innerText = "" + timestamp;
        uc.appendChild(nameElem);
        uc.appendChild(commentElem);
        uc.appendChild(hmsElem);
        uc.appendChild(origTS);
        if (appendNow)
            fcd.commsDiv.appendChild(uc);
        else
            return uc;
    }
}
class FrameCommentsDisplay {
    constructor(App, fwd, id) {
        this.id = id;
        this.fwd = fwd;
        this.App = App;
        this.json = null;
        this.commsDiv = Util.newDiv("fcd-comms");
        this.setupNewCommentField(App);
        const commbarhost = App.getCommbarhost();
        commbarhost.appendChild(this.newCommentDiv);
        commbarhost.appendChild(this.commsDiv);
        this.addWinResizeHandler(); // mostly for repositioning the wave tags
        return this;
    }
    scrollTo(tsSec) {
        let closest = null;
        // find closest. linear search -.-
        for (let i = 0; i < this.commsDiv.children.length; i++) {
            const uc = this.commsDiv.children[i];
            if (!closest) {
                closest = uc;
                continue;
            }
            const iOrigTS = uc.getElementsByClassName("aOrigTS")[0];
            const iDelta = Math.abs(tsSec - parseInt(iOrigTS.innerText, 10));
            const cOrigTS = closest.getElementsByClassName("aOrigTS")[0];
            const cDelta = Math.abs(tsSec - parseInt(cOrigTS.innerText, 10));
            if (iDelta < cDelta)
                closest = uc;
        }
        closest.scrollIntoView();
    }
    destroyAllWaveTags() {
        const usqs = document.getElementsByClassName("usq");
        while (usqs.length > 0)
            usqs[0].parentNode.removeChild(usqs[0]);
    }
    refreshComments(id) {
        if (!this.json)
            return this.populateSelf();
        this.id = id;
        this.commsDiv.innerHTML = ""; // delete stale comments
        this.destroyAllWaveTags();
        for (const id in this.json)
            if (this.json[id].track === parseInt(this.id, 10)) {
                this.insertNewComment(id, this.json[id].nam, this.json[id].comment, this.json[id].timestamp);
                this.tagTheWave(this.json[id].nam, this.json[id].timestamp);
            }
    }
    tagTheWave(nam, ts) {
        const idn = parseInt(this.id, 10);
        if (!this.App.audioCache[idn] ||
            Number.isNaN(this.App.audioCache[idn].duration)) {
            console.log("debug: deferring wave-tagging");
            setTimeout(() => {
                this.tagTheWave(nam, ts);
            }, 500); // promise poll hack
            return;
        }
        const waveDiv = this.fwd.waveDiv;
        const wdBCR = waveDiv.getBoundingClientRect();
        let xcoord = ts / this.App.audioCache[idn].duration * window.innerWidth; // XXX
        if (xcoord + 25 > window.innerWidth)
            xcoord = window.innerWidth - 25;
        const ycoord = wdBCR.top + wdBCR.height - 25;
        const usq = Util.newDiv("usq"); // user comment represented by a square
        usq.style.width = 25 + "px";
        usq.style.height = 25 + "px";
        usq.style.left = xcoord + "px";
        usq.style.top = ycoord + "px";
        usq.innerText = nam.substring(0, 1);
        usq.addEventListener("click", () => {
            this.scrollTo(ts);
            this.App.audio.currentTime = ts;
        });
        waveDiv.appendChild(usq);
    }
    populateSelf() {
        fetch("/private/getcomments").then(resp => {
            if (resp.ok)
                return resp.json();
            else
                console.log("could not fetch comments");
        }).then(json => {
            this.json = json;
            // add new comments
            for (const id in json) {
                if (json[id].track !== parseInt(this.id, 10))
                    continue;
                this.insertNewComment(id, json[id].nam, json[id].comment, json[id].timestamp);
                this.tagTheWave(json[id].nam, json[id].timestamp);
            }
        }).catch(e => {
            console.log("fetch error: ", e);
        });
    }
    insertNewComment(id, nam, text, ts) {
        const nc = new UserComment(this, nam, text, ts, false);
        const num = Object.keys(this.json).length + 1;
        if (id === "-1")
            this.json[num] = {
                "nam": nam,
                "comment": text,
                "timestamp": ts,
                "track": parseInt(this.id, 10)
            };
        this.tagTheWave(nam, ts);
        if (this.commsDiv.children.length < 1) { // comments div has 0 children
            this.commsDiv.appendChild(nc); // so insert at beginning
            return;
        }
        let i = 0;
        let incumbent = this.commsDiv.children[i];
        let incumbentTS = parseInt(incumbent.getElementsByClassName("aOrigTS")[0].innerText, 10);
        while (incumbentTS < ts) { // warn: linear search
            if (i + 1 === this.commsDiv.children.length) { // insert at end
                incumbent.insertAdjacentElement("afterend", nc);
                return;
            }
            incumbent = this.commsDiv.children[++i];
            incumbentTS = parseInt(incumbent.getElementsByClassName("aOrigTS")[0].innerText, 10);
        }
        incumbent.insertAdjacentElement("beforebegin", nc); // insert at middle
        return;
    }
    setupNewCommentField(App) {
        this.newCommentDiv = Util.newDiv("fcd-newcomment");
        const ncNameField = document.createElement("input"); // nc is new comm
        ncNameField.className = "ncnamefield";
        ncNameField.placeholder = "Username";
        const ncTextField = document.createElement("textarea");
        ncTextField.className = "nctextfield";
        ncTextField.placeholder = "Comment";
        const ncSubmitButton = document.createElement("button");
        ncSubmitButton.className = "ncsubmitbutton";
        ncSubmitButton.innerText = "Post Comment";
        ncSubmitButton.addEventListener("click", () => {
            const ts = App.audio.currentTime;
            const text = ncTextField.value;
            const nam = ncNameField.value;
            const req = new Request("/private/setcomment", {
                method: "POST",
                body: JSON.stringify({
                    "nam": nam,
                    "comment": text,
                    "timestamp": ts + "",
                    "track": this.id
                })
            });
            fetch(req);
            this.insertNewComment("-1", nam, text, ts);
            ncTextField.value = "";
            ncNameField.value = "";
        });
        this.newCommentDiv.appendChild(ncNameField);
        this.newCommentDiv.appendChild(ncTextField);
        this.newCommentDiv.appendChild(ncSubmitButton);
    }
    addWinResizeHandler() {
        window.addEventListener("resize", () => {
            if (!this.json)
                return;
            this.destroyAllWaveTags();
            for (const id in this.json)
                if (this.json[id].track == parseInt(this.id, 10))
                    this.tagTheWave(this.json[id].nam, this.json[id].timestamp);
        });
    }
}
class Bar {
    // Helper for constructor to add event listeners to bar buttons.
    addEventListeners(App, play, ff, rw, fsd, fwd, fcd) {
        play.innerText = "Play";
        play.addEventListener("click", () => {
            if (Util.currTrack && Util.currTrack.filepath) {
                if (!App.audio) {
                    App.audio = new Audio(Util.currTrack.filepath);
                    App.audio.play();
                }
                else { // toggle
                    if (App.audio.paused) {
                        App.audio.play();
                        play.innerText = "Pause";
                    }
                    else {
                        App.audio.pause();
                        play.innerText = "Play";
                    }
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
                    App.populateAudio(App.tracksIndex + "", fsd, fwd, fcd);
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
                    App.populateAudio(App.tracksIndex + "", fsd, fwd, fcd);
                    play.innerText = "Pause";
                }
            });
        });
    }
    constructor(App, fsd, fwd, fcd) {
        const bar = Util.newDiv("bar");
        const play = Util.newDiv("play");
        const ff = Util.newDiv("ff");
        const rw = Util.newDiv("rw");
        bar.appendChild(ff);
        bar.appendChild(play);
        bar.appendChild(rw);
        this.addEventListeners(App, play, ff, rw, fsd, fwd, fcd);
        const commbarhost = App.getCommbarhost();
        commbarhost.appendChild(bar);
    }
}
class App {
    constructor() {
        this.commbarhost = null;
        this.audio = null;
        this.watcherID = 0;
        this.audioCache = new Array();
        this.tracksIndex = -1;
        this.app = Util.newDiv("app");
        document.body.appendChild(this.app);
        const fsd = new FrameSongDisplay(this.app);
        const fwd = new FrameWaveDisplay(this);
        const fcd = new FrameCommentsDisplay(this, fwd, "1");
        new Bar(this, fsd, fwd, fcd);
        this.getAudio();
        this.populateAudio("1", fsd, fwd, fcd);
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
    // Helper for setupWatcher to find the shadow element.
    getShadow(fwd) {
        const shadows = this.app.getElementsByClassName("shadow");
        let shadow = null;
        if (shadows.length < 1) {
            shadow = Util.newDiv("shadow");
            shadow.style.position = "absolute";
            shadow.style.backgroundColor = "rgba(255, 160, 0, 0.5)";
            fwd.waveDiv.appendChild(shadow);
        }
        else
            shadow = shadows[0];
        return shadow;
    }
    setupWatcher(fwd) {
        if (this.watcherID !== 0)
            return;
        const shadow = this.getShadow(fwd);
        clearInterval(this.watcherID); // destroy any old watcher
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
    // Change the current song.
    populateAudio(idstr, fsd, fwd, fcd) {
        const id = parseInt(idstr, 10);
        if (this.audio)
            this.audio.pause();
        this.tracks.then((tracks) => {
            this.tracksIndex = id;
            Util.currTrack = tracks[id];
            const track = tracks[id];
            fsd.setTitle(track.nam);
            fsd.setArtist(track.artist);
            fsd.setImg(track.picpath, this);
            fwd.setTrack(track.filepath, id + "");
            fcd.refreshComments(id + "");
            if (this.audioCache[id] !== undefined) // use cached copy
                this.audio = this.audioCache[id];
            else { // fetch new copy
                this.audio = new Audio(track.filepath);
                this.audioCache[id] = this.audio; // cache it
            }
            this.audio.play();
            this.setupWatcher(fwd);
        });
    }
}
(() => {
    new App();
})();
