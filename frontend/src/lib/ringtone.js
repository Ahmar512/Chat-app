// Web Audio API Ringtone & Ringback Generator
class SoundPlayer {
    constructor() {
        this.ctx = null;
        this.intervalId = null;
        this.activeOscillators = [];
    }

    initContext() {
        if (!this.ctx || this.ctx.state === "closed") {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }

    // Play pleasant dual-frequency telephone chime burst
    playRingBurst(freq1 = 440, freq2 = 480, duration = 1.2) {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(freq1, now);
        osc2.frequency.setValueAtTime(freq2, now);

        // Fade in & out to avoid clicks
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.12, now + duration - 0.1);
        gain.gain.linearRampToValueAtTime(0.001, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);

        this.activeOscillators.push(osc1, osc2);
    }

    // Incoming ringtone: Repeating chime pattern
    startIncomingRingtone() {
        this.stop();
        this.initContext();

        this.playRingBurst(440, 480, 1.2);
        this.intervalId = setInterval(() => {
            this.playRingBurst(440, 480, 1.2);
        }, 3000);
    }

    // Outgoing ringback: Softer, lower frequency periodic beep
    startOutgoingTone() {
        this.stop();
        this.initContext();

        this.playRingBurst(400, 450, 0.8);
        this.intervalId = setInterval(() => {
            this.playRingBurst(400, 450, 0.8);
        }, 3500);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.activeOscillators.forEach((osc) => {
            try {
                osc.stop();
            } catch (e) {
                // already stopped
            }
        });
        this.activeOscillators = [];
    }
}

export const ringtone = new SoundPlayer();
