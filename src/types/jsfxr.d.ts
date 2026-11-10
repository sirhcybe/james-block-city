declare module 'jsfxr' {
  export const sfxr: {
    toWebAudio(
      synthdef: Record<string, number | boolean>,
      ctx: AudioContext,
    ): AudioBufferSourceNode | undefined;
    generate(preset: string, options?: Record<string, number>): Record<string, number | boolean>;
  };
}
