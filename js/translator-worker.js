import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';

let translatorPromise;

// This function starts the model loading process but can be called multiple times safely.
function loadModel() {
  if (!translatorPromise) {
    console.log('Fallback model is loading in the background...');
    translatorPromise = pipeline('translation', 'Xenova/nllb-200-distilled-600M');
    translatorPromise.then(() => console.log('Fallback model loading complete.'));
  }
  return translatorPromise;
}

const langCodeMap = {
  en: 'eng_Latn',
  es: 'spa_Latn',
  fr: 'fra_Latn',
  de: 'deu_Latn',
  ja: 'jpn_Jpan',
  uk: 'ukr_Cyrl',
  hi: 'hin_Deva',
};

self.onmessage = async (event) => {
  const { type, text, sourceLanguage, targetLanguage } = event.data;

  // Handle the two different message types.
  switch (type) {
    case 'PRELOAD':
      // This just kicks off the download and doesn't wait for it.
      loadModel();
      break;

    case 'TRANSLATE':
      try {
        self.postMessage({ status: 'loading-model' });

        // This will either start the download or wait for the in-progress one.
        const translator = await loadModel();

        self.postMessage({ status: 'translating' });

        const modelSourceLang = langCodeMap[sourceLanguage] || 'eng_Latn';
        const modelTargetLang = langCodeMap[targetLanguage];

        if (!modelTargetLang) {
          throw new Error(`The target language "${targetLanguage}" is not supported by the fallback model map.`);
        }

        const [result] = await translator(text, {
          src_lang: modelSourceLang,
          tgt_lang: modelTargetLang,
        });

        self.postMessage({
          status: 'success',
          translatedText: result.translation_text,
        });
      } catch (error) {
        self.postMessage({
          status: 'error',
          message: error.message,
        });
      }
      break;
  }
};
