import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.11.0';

let translator;

self.onmessage = async (event) => {
  const { text, targetLanguage } = event.data;

  try {
    // Initialize the translator pipeline only once.
    if (!translator) {
      translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
    }

    const [result] = await translator(text, { tgt_lang: targetLanguage });
    
    // Send the successful result back to the main thread.
    self.postMessage({
      status: 'success',
      translatedText: result.translation_text,
    });
  } catch (error) {
    // Send an error message back to the main thread.
    self.postMessage({
      status: 'error',
      message: error.message,
    });
  }
};