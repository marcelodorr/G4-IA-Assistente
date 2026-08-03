"use client";

export type CaptureChannel = "meeting" | "microphone";

export type BrowserCaptureCallbacks = {
  onPartial: (channel: CaptureChannel, text: string) => void;
  onCommitted: (channel: CaptureChannel, text: string) => void | Promise<void>;
  onError: (message: string) => void;
  onEnded: () => void;
};

export type BrowserCaptureSession = {
  hasMicrophone: boolean;
  stop: () => Promise<void>;
};

const WORKLET_SOURCE = `
class SequorPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("sequor-pcm-processor", SequorPcmProcessor);
`;

function downsample(input: Float32Array, inputRate: number, outputRate = 16_000) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let total = 0;
    for (let j = start; j < end; j++) total += input[j];
    output[i] = total / Math.max(1, end - start);
  }
  return output;
}

function pcm16Base64(input: Float32Array) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function requestToken() {
  const response = await fetch("/api/meetings/transcription-token", { method: "POST" });
  const body = await response.json().catch(() => ({})) as { token?: string; error?: string };
  if (!response.ok || !body.token) throw new Error(body.error ?? "Não foi possível autorizar a transcrição");
  return body.token;
}

function openScribeSocket(token: string, channel: CaptureChannel, callbacks: BrowserCaptureCallbacks) {
  const params = new URLSearchParams({
    token, model_id: "scribe_v2_realtime", audio_format: "pcm_16000", language_code: "pt",
    commit_strategy: "vad", vad_silence_threshold_secs: "1.2", min_speech_duration_ms: "250",
  });
  const socket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`);
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Tempo esgotado ao conectar ao ElevenLabs")), 15_000);
    socket.addEventListener("open", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { window.clearTimeout(timeout); reject(new Error("Falha na conexão em tempo real com o ElevenLabs")); }, { once: true });
  });
  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(String(event.data)) as { message_type?: string; text?: string; error?: string; message?: string };
      if (data.message_type === "partial_transcript") callbacks.onPartial(channel, data.text ?? "");
      if (data.message_type === "committed_transcript" && data.text?.trim()) {
        callbacks.onPartial(channel, "");
        void callbacks.onCommitted(channel, data.text.trim());
      }
      if (data.error || data.message_type?.includes("error")) callbacks.onError(data.error ?? data.message ?? "Falha na transcrição em tempo real");
    } catch { /* Eventos desconhecidos não interrompem a captura. */ }
  });
  return { socket, ready };
}

export async function startBrowserCapture(callbacks: BrowserCaptureCallbacks): Promise<BrowserCaptureSession> {
  if (!navigator.mediaDevices?.getDisplayMedia || !window.AudioContext || !window.AudioWorkletNode) {
    throw new Error("Este navegador não oferece captura de áudio compatível. Use uma versão recente do Chrome ou Edge.");
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  if (displayStream.getAudioTracks().length === 0) {
    displayStream.getTracks().forEach((track) => track.stop());
    throw new Error("Nenhum áudio foi compartilhado. Selecione a aba da reunião e marque “Compartilhar áudio da aba”.");
  }
  let microphoneStream: MediaStream | null = null;
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch {
    callbacks.onError("Microfone não autorizado. A reunião continuará apenas com o áudio compartilhado.");
  }

  let context: AudioContext;
  try { context = new AudioContext({ sampleRate: 16_000 }); }
  catch { context = new AudioContext(); }
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "text/javascript" }));
  await context.audioWorklet.addModule(workletUrl);
  URL.revokeObjectURL(workletUrl);

  const channels: Array<{ channel: CaptureChannel; stream: MediaStream }> = [{ channel: "meeting", stream: displayStream }];
  if (microphoneStream) channels.push({ channel: "microphone", stream: microphoneStream });
  const tokens = await Promise.all(channels.map(() => requestToken()));
  const sockets = channels.map((item, index) => ({ ...item, ...openScribeSocket(tokens[index], item.channel, callbacks) }));

  try { await Promise.all(sockets.map((item) => item.ready)); }
  catch (error) {
    sockets.forEach((item) => item.socket.close());
    displayStream.getTracks().forEach((track) => track.stop());
    microphoneStream?.getTracks().forEach((track) => track.stop());
    await context.close();
    throw error;
  }

  const nodes = sockets.map((item) => {
    const source = context.createMediaStreamSource(item.stream);
    const processor = new AudioWorkletNode(context, "sequor-pcm-processor");
    const mute = context.createGain();
    mute.gain.value = 0;
    processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (item.socket.readyState !== WebSocket.OPEN) return;
      const audio = downsample(event.data, context.sampleRate);
      item.socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: pcm16Base64(audio), sample_rate: 16_000 }));
    };
    source.connect(processor).connect(mute).connect(context.destination);
    return { source, processor, mute };
  });
  await context.resume();

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    nodes.forEach(({ source, processor, mute }) => { source.disconnect(); processor.disconnect(); mute.disconnect(); });
    sockets.forEach(({ socket }) => socket.close(1000, "Captura encerrada"));
    displayStream.getTracks().forEach((track) => track.stop());
    microphoneStream?.getTracks().forEach((track) => track.stop());
    await context.close().catch(() => undefined);
  };
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => { if (!stopped) { void stop(); callbacks.onEnded(); } }, { once: true });

  return { hasMicrophone: Boolean(microphoneStream), stop };
}
