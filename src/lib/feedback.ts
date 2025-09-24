let toneContext: AudioContext | null = null

export async function playConfirmationTone() {
  try {
    toneContext = toneContext ?? new AudioContext()
    const ctx = toneContext
    if (ctx.state === "suspended") {
      await ctx.resume()
    }
    const duration = 0.2
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + duration)
  } catch (error) {
    console.warn("Unable to play confirmation tone", error)
  }
}
