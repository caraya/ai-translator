import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';

let translator;

// This map translates standard language codes to the NLLB model's required format.
const langCodeMap = {
  en: 'eng_Latn', // English
  es: 'spa_Latn', // Spanish
  fr: 'fra_Latn', // French
  de: 'deu_Latn', // German
  ja: 'jpn_Jpan', // Japanese
  uk: 'ukr_Cyrl', // Ukrainian
  hi: 'hin_Deva', // Hindi
};

self.onmessage = async (event) => {
  const { text, sourceLanguage, targetLanguage } = event.data;

  try {
    self.postMessage({ status: 'loading-model' });

    if (!translator) {
      translator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
    }

    self.postMessage({ status: 'translating' });

    // ---- START: FIX ----
    // 1. Look up the source language from the map.
    // 2. If the lookup fails (because sourceLanguage is null or not in the map),
    //    default to 'eng_Latn'.
    const modelSourceLang = langCodeMap[sourceLanguage] || 'eng_Latn';
    const modelTargetLang = langCodeMap[targetLanguage];
    // ---- END: FIX ----

    if (!modelTargetLang) {
      throw new Error(`The target language "${targetLanguage}" is not supported by the fallback model map.`);
    }

    const [result] = await translator(text, {
      src_lang: modelSourceLang, // This will now always have a valid value.
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
};