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
