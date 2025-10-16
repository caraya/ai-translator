class LanguageTranslator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    try {
      this.worker = new Worker('./js/translator-worker.js', { type: 'module' });

      this.worker.onmessage = (event) => {
        const { status, translatedText, message } = event.data;
        const contentSelector = this.getAttribute('content-selector');
        const elementToTranslate = document.querySelector(contentSelector);
        if (!elementToTranslate) return;

        if (status === 'loading-model' || status === 'translating') {
          // Progress messages can be logged or handled if a status display is re-added
        } else if (status === 'success') {
          elementToTranslate.textContent = translatedText;
          console.timeEnd('Fallback Translation');
        } else if (status === 'error') {
          console.error('Worker translation failed:', message);
          elementToTranslate.textContent = `[Translation Error]`; // Revert or show error
          console.timeEnd('Fallback Translation');
        }
      };
    } catch (error) {
      console.error("Failed to initialize the translation worker.", error);
      this.worker = null;
    }
  }

  connectedCallback() {
    this.render();

    const isNativeApiAvailable = 'Translator' in self && 'LanguageDetector' in self;
    if (!isNativeApiAvailable && this.worker) {
      this.worker.postMessage({ type: 'PRELOAD' });
    }
  }

  async translate() {
    const contentSelector = this.getAttribute('content-selector');
    if (!contentSelector) {
      console.error("Error: 'content-selector' attribute is missing.");
      return;
    }

    const elementToTranslate = document.querySelector(contentSelector);
    if (!elementToTranslate || !elementToTranslate.textContent) return;

    // Store original text in case of failure or for re-translation
    if (!elementToTranslate.dataset.originalText) {
        elementToTranslate.dataset.originalText = elementToTranslate.textContent;
    }
    const originalText = elementToTranslate.dataset.originalText;

    const selectElement = this.shadowRoot.querySelector('#language-select');
    const targetLanguage = selectElement.value;
    const forceFallback = this.shadowRoot.querySelector('#force-fallback').checked;

    if (!forceFallback && 'Translator' in self && 'LanguageDetector' in self) {
      try {
        const detector = await LanguageDetector.create();
        const detectionResults = await detector.detect(originalText);

        if (!detectionResults || detectionResults.length === 0 || !detectionResults[0].detectedLanguage) {
          throw new Error("Language detection returned an empty or invalid result.");
        }

        const sourceLanguage = detectionResults[0].detectedLanguage;

        elementToTranslate.textContent = 'Preparing model...';

        const translator = await Translator.create({
          sourceLanguage,
          targetLanguage,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const percentage = (e.loaded / e.total) * 100;
              elementToTranslate.textContent = `Downloading: ${percentage.toFixed(0)}%`;
            });
          },
        });

        elementToTranslate.textContent = ''; // Clear for streaming
        const stream = translator.translateStreaming(originalText);
        for await (const chunk of stream) {
          elementToTranslate.textContent += chunk;
        }

      } catch (error) {
        console.error('Built-in translation failed, falling back to worker:', error);
        elementToTranslate.textContent = originalText; // Revert on failure
        const detector = await LanguageDetector.create();
        const detectionResults = await detector.detect(originalText);
        const sourceLanguage = detectionResults[0].detectedLanguage;
        this.fallbackTranslateWithWorker(originalText, sourceLanguage, targetLanguage);
      }
    } else {
      console.log("Using fallback translator.");
      this.fallbackTranslateWithWorker(originalText, null, targetLanguage);
    }
  }

  fallbackTranslateWithWorker(text, sourceLanguage, targetLanguage) {
    if (!this.worker) {
        console.error('Fallback worker is not available.');
        return;
    }
    const elementToTranslate = document.querySelector(this.getAttribute('content-selector'));
    if (elementToTranslate) {
      elementToTranslate.textContent = 'Initializing fallback...';
    }
    console.time('Fallback Translation');
    this.worker.postMessage({
      type: 'TRANSLATE',
      text,
      sourceLanguage,
      targetLanguage
    });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: sans-serif;
          border: 1px solid #ccc;
          padding: 8px;
          border-radius: 8px;
        }
        select, button {
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid #ccc;
          background-color: #fff;
        }
        button {
          border: none;
          background-color: #007bff;
          color: white;
          cursor: pointer;
        }
        button:hover {
          background-color: #0056b3;
        }
        .fallback-option {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.9em;
        }
      </style>

      <select id="language-select">
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="ja">Japanese</option>
        <option value="uk">Ukrainian*</option>
        <option value="hi">Hindi*</option>
      </select>

      <button id="translate-btn">Translate</button>

      <div class="fallback-option">
        <input type="checkbox" id="force-fallback">
        <label for="force-fallback">Force fallback</label>
      </div>
    `;

    this.shadowRoot.querySelector('#translate-btn').addEventListener('click', () => this.translate());
  }
}

customElements.define('language-translator', LanguageTranslator);

// class LanguageTranslator extends HTMLElement {
//   constructor() {
//     // ... constructor remains the same
//     super();
//     this.attachShadow({ mode: 'open' });

//     try {
//       this.worker = new Worker('./js/translator-worker.js', { type: 'module' });

//       this.worker.onmessage = (event) => {
//         const { status, translatedText, message } = event.data;
//         const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
//         if (!translatedContentEl) return;

//         if (status === 'loading-model') {
//           translatedContentEl.textContent = 'Loading fallback model (this may take a while)...';
//         } else if (status === 'translating') {
//           translatedContentEl.textContent = 'Translating with fallback model...';
//         } else if (status === 'success') {
//           translatedContentEl.textContent = translatedText;
//           console.timeEnd('Fallback Translation');
//         } else if (status === 'error') {
//           console.error('Worker translation failed:', message);
//           translatedContentEl.textContent = `Fallback translation failed: ${message}`;
//           console.timeEnd('Fallback Translation');
//         }
//       };
//     } catch (error) {
//       console.error("Failed to initialize the translation worker. Ensure the path is correct.", error);
//       this.worker = null;
//     }
//   }

//   connectedCallback() {
//     // ... connectedCallback remains the same
//     this.render();

//     const isNativeApiAvailable = 'Translator' in self && 'LanguageDetector' in self;
//     if (!isNativeApiAvailable && this.worker) {
//       console.log('Native API not found. Instructing worker to preload fallback model.');
//       this.worker.postMessage({ type: 'PRELOAD' });
//     }

//     if (!this.worker) {
//         const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
//         if(translatedContentEl) {
//             translatedContentEl.textContent = 'Error: The translation worker script could not be loaded.';
//         }
//     }
//   }

//   async translate() {
//     // ... translate method remains the same
//     const originalContentEl = this.shadowRoot.querySelector('#original-content');
//     if (!originalContentEl) return;

//     const contentSelector = this.getAttribute('content-selector');
//     if (!contentSelector) {
//       originalContentEl.textContent = "Error: 'content-selector' attribute is missing.";
//       return;
//     }

//     const elementToTranslate = document.querySelector(contentSelector);
//     if (!elementToTranslate || !elementToTranslate.textContent) return;

//     const originalText = elementToTranslate.textContent;
//     originalContentEl.textContent = originalText;

//     const selectElement = this.shadowRoot.querySelector('#language-select');
//     const targetLanguage = selectElement.value;
//     const translatedContentEl = this.shadowRoot.querySelector('#translated-content');

//     const forceFallback = this.shadowRoot.querySelector('#force-fallback').checked;

//     if (!forceFallback && 'Translator' in self && 'LanguageDetector' in self) {
//       translatedContentEl.textContent = 'Checking for built-in translator...';
//       try {
//         const detector = await LanguageDetector.create();
//         const detectionResults = await detector.detect(originalText);

//         if (
//           !Array.isArray(detectionResults) ||
//           detectionResults.length === 0 ||
//           !detectionResults[0].detectedLanguage
//         ) {
//           throw new Error("Language detection returned an empty or invalid result.");
//         }

//         const sourceLanguage = detectionResults[0].detectedLanguage;

//         translatedContentEl.textContent = 'Preparing translation model...';

//         const translator = await Translator.create({
//           sourceLanguage,
//           targetLanguage,
//           monitor(m) {
//             m.addEventListener('downloadprogress', (e) => {
//               const percentage = (e.loaded / e.total) * 100;
//               translatedContentEl.textContent = `Downloading translation model: ${percentage.toFixed(0)}%`;
//             });
//           },
//         });

//         translatedContentEl.textContent = '';
//         const stream = translator.translateStreaming(originalText);
//         for await (const chunk of stream) {
//           translatedContentEl.textContent += chunk;
//         }

//       } catch (error) {
//         console.error('Built-in translation failed, falling back to worker:', error);
//         const detector = await LanguageDetector.create();
//         const detectionResults = await detector.detect(originalText);
//         const sourceLanguage = detectionResults[0].detectedLanguage;
//         this.fallbackTranslateWithWorker(originalText, sourceLanguage, targetLanguage);
//       }
//     } else {
//       console.log("Using fallback translator (API not found or forced by user).");
//       this.fallbackTranslateWithWorker(originalText, null, targetLanguage);
//     }
//   }

//   fallbackTranslateWithWorker(text, sourceLanguage, targetLanguage) {
//     // ... fallbackTranslateWithWorker remains the same
//     if (!this.worker) {
//         const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
//         if (translatedContentEl) {
//             translatedContentEl.textContent = 'Fallback worker is not available.';
//         }
//         return;
//     }

//     const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
//     if (translatedContentEl) {
//         translatedContentEl.textContent = 'Initializing fallback process...';
//     }
//     console.time('Fallback Translation');
//     this.worker.postMessage({
//       type: 'TRANSLATE',
//       text,
//       sourceLanguage,
//       targetLanguage
//     });
//   }

//   render() {
//     // --- START: CHANGES FOR UI FLAGGING ---
//     const languages = [
//       { code: 'es', name: 'Spanish' },
//       { code: 'fr', name: 'French' },
//       { code: 'de', name: 'German' },
//       { code: 'ja', name: 'Japanese' },
//       { code: 'uk', name: 'Ukrainian', fallbackOnly: true },
//       { code: 'hi', name: 'Hindi', fallbackOnly: true },
//     ];

//     const optionsHTML = languages.map(lang =>
//       `<option value="${lang.code}">
//         ${lang.name}${lang.fallbackOnly ? '*' : ''}
//       </option>`
//     ).join('');
//     // --- END: CHANGES FOR UI FLAGGING ---

//     this.shadowRoot.innerHTML = `
//       <style>
//         :host { display: block; font-family: sans-serif; border: 1px solid #ccc; padding: 16px; border-radius: 8px; max-width: 600px; }
//         #controls { margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
//         h3 { margin-top: 0; margin-bottom: 8px; color: #333; }
//         p { margin-top: 0; color: #555; }
//         #translated-content { font-style: italic; color: #333; }
//         select, button { padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; }
//         button { border: none; background-color: #007bff; color: white; cursor: pointer; }
//         button:hover { background-color: #0056b3; }
//         .fallback-option { margin-top: 8px; display: flex; align-items: center; gap: 4px; font-size: 0.9em; width: 100%;}
//         /* --- NEW: Style for the explainer text --- */
//         .info-text { font-size: 0.8em; color: #666; width: 100%; margin-top: 4px; }
//       </style>
//       <div id="controls">
//         <label for="language-select">Translate to:</label>
//         <select id="language-select">
//           ${optionsHTML}
//         </select>
//         <button id="translate-btn">Translate</button>
//         <div class="fallback-option">
//           <input type="checkbox" id="force-fallback">
//           <label for="force-fallback">Force fallback model</label>
//         </div>
//         <div class="info-text">* Requires fallback model. May not work if browser's native API is available.</div>
//       </div>
//       <div>
//         <h3>Original</h3>
//         <p id="original-content">The original text will appear here once you press translate.</p>
//       </div>
//       <div>
//         <h3>Translated</h3>
//         <p id="translated-content">Select a language and press translate.</p>
//       </div>
//     `;

//     this.shadowRoot.querySelector('#translate-btn').addEventListener('click', () => this.translate());
//   }
// }

// customElements.define('language-translator', LanguageTranslator);
