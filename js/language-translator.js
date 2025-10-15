class LanguageTranslator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // ---- START: FIX ----
    // Wrap the worker initialization in a try...catch block.
    // This prevents a bad path from stopping the entire component from rendering.
    try {
      this.worker = new Worker('./js/translator-worker.js', { type: 'module' });
      
      this.worker.onmessage = (event) => {
        const { status, translatedText, message } = event.data;
        const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
        if (!translatedContentEl) return;

        if (status === 'loading-model') {
          translatedContentEl.textContent = 'Loading fallback model (this may take a while)...';
        } else if (status === 'translating') {
          translatedContentEl.textContent = 'Translating with fallback model...';
        } else if (status === 'success') {
          translatedContentEl.textContent = translatedText;
          console.timeEnd('Fallback Translation');
        } else if (status === 'error') {
          console.error('Worker translation failed:', message);
          translatedContentEl.textContent = `Fallback translation failed: ${message}`;
          console.timeEnd('Fallback Translation');
        }
      };
    } catch (error) {
      console.error("Failed to initialize the translation worker. Ensure the path is correct.", error);
      // We set this.worker to null so other methods know it's not available.
      this.worker = null;
    }
    // ---- END: FIX ----
  }

  connectedCallback() {
    this.render();
    // If the worker failed to load, display an error message.
    if (!this.worker) {
        const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
        if(translatedContentEl) {
            translatedContentEl.textContent = 'Error: The translation worker script could not be loaded.';
        }
    }
  }
  
  async translate() {
    const originalContentEl = this.shadowRoot.querySelector('#original-content');
    if (!originalContentEl) return;

    const contentSelector = this.getAttribute('content-selector');
    if (!contentSelector) {
      originalContentEl.textContent = "Error: 'content-selector' attribute is missing.";
      return;
    }

    const elementToTranslate = document.querySelector(contentSelector);
    if (!elementToTranslate || !elementToTranslate.textContent) return;

    const originalText = elementToTranslate.textContent;
    originalContentEl.textContent = originalText; 

    const selectElement = this.shadowRoot.querySelector('#language-select');
    const targetLanguage = selectElement.value;
    const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
    
    const forceFallback = this.shadowRoot.querySelector('#force-fallback').checked;

    if (!forceFallback && 'Translator' in self && 'LanguageDetector' in self) {
      translatedContentEl.textContent = 'Checking for built-in translator...';
      try {
        const detector = await LanguageDetector.create();
        const detectionResults = await detector.detect(originalText);

        if (
          !Array.isArray(detectionResults) ||
          detectionResults.length === 0 ||
          !detectionResults[0].detectedLanguage
        ) {
          throw new Error("Language detection returned an empty or invalid result.");
        }
        
        const sourceLanguage = detectionResults[0].detectedLanguage;

        translatedContentEl.textContent = 'Preparing translation model...';

        const translator = await Translator.create({
          sourceLanguage,
          targetLanguage,
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const percentage = (e.loaded / e.total) * 100;
              translatedContentEl.textContent = `Downloading translation model: ${percentage.toFixed(0)}%`;
            });
          },
        });

        translatedContentEl.textContent = ''; 
        const stream = translator.translateStreaming(originalText);
        for await (const chunk of stream) {
          translatedContentEl.textContent += chunk;
        }

      } catch (error) {
        console.error('Built-in translation failed, falling back to worker:', error);
        const detector = await LanguageDetector.create();
        const detectionResults = await detector.detect(originalText);
        const sourceLanguage = detectionResults[0].detectedLanguage;
        this.fallbackTranslateWithWorker(originalText, sourceLanguage, targetLanguage);
      }
    } else {
      console.log("Using fallback translator (API not found or forced by user).");
      this.fallbackTranslateWithWorker(originalText, null, targetLanguage);
    }
  }
  
  fallbackTranslateWithWorker(text, sourceLanguage, targetLanguage) {
    // If the worker failed to initialize, we can't proceed.
    if (!this.worker) {
        const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
        if (translatedContentEl) {
            translatedContentEl.textContent = 'Fallback worker is not available.';
        }
        return;
    }

    const translatedContentEl = this.shadowRoot.querySelector('#translated-content');
    if (translatedContentEl) {
        translatedContentEl.textContent = 'Initializing fallback process...';
    }
    console.time('Fallback Translation'); 
    this.worker.postMessage({ text, sourceLanguage, targetLanguage });
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: sans-serif; border: 1px solid #ccc; padding: 16px; border-radius: 8px; max-width: 600px; }
        #controls { margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        h3 { margin-top: 0; margin-bottom: 8px; color: #333; }
        p { margin-top: 0; color: #555; }
        #translated-content { font-style: italic; color: #333; }
        select, button { padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; }
        button { border: none; background-color: #007bff; color: white; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        .fallback-option { margin-top: 8px; display: flex; align-items: center; gap: 4px; font-size: 0.9em; width: 100%;}
      </style>
      <div id="controls">
        <label for="language-select">Translate to:</label>
        <select id="language-select">
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ja">Japanese</option>
          <option value="uk">Ukrainian</option>
          <option value="hi">Hindi</option>
        </select>
        <button id="translate-btn">Translate</button>
        <div class="fallback-option">
          <input type="checkbox" id="force-fallback">
          <label for="force-fallback">Force fallback model</label>
        </div>
      </div>
      <div>
        <h3>Original</h3>
        <p id="original-content">The original text will appear here once you press translate.</p>
      </div>
      <div>
        <h3>Translated</h3>
        <p id="translated-content">Select a language and press translate.</p>
      </div>
    `;
    
    this.shadowRoot.querySelector('#translate-btn').addEventListener('click', () => this.translate());
  }
}

customElements.define('language-translator', LanguageTranslator);