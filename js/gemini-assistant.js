/**
 * OneAbility AI - Gemini Assistant Frontend Client
 * Communicates ONLY with backend POST /api/assistant/chat.
 * Zero Gemini SDK or API keys on client-side.
 */

class GeminiAssistantClient {
  constructor() {
    // Primary backend port 8001, with fallback to 8000
    this.primaryBaseUrl = 'http://127.0.0.1:8001';
    this.secondaryBaseUrl = 'http://127.0.0.1:8000';
    this.activeBaseUrl = this.primaryBaseUrl;
  }

  /**
   * Sends user message to backend assistant endpoint.
   * @param {string} message - Raw user speech transcript or text
   * @param {string} language - Active language code ('ta' or 'en')
   * @param {object} context - Optional context state
   * @returns {Promise<object>} Structured response { reply, language, intent, recipient, amount, action, confidence }
   */
  async sendMessage(message, language = 'ta', context = {}) {
    const ctx = Object.assign({}, context || {});
    if (!ctx.preferred_name && window.UserManager && typeof window.UserManager.getAssistantCallName === 'function') {
      ctx.preferred_name = window.UserManager.getAssistantCallName();
    }

    const payload = {
      message: (message || '').trim(),
      language: language === 'ta' ? 'ta' : 'en',
      context: ctx
    };

    try {
      return await this._requestChat(this.activeBaseUrl, payload);
    } catch (primaryErr) {
      console.warn(`[GeminiAssistant] Backend request failed on ${this.activeBaseUrl}:`, primaryErr.message);

      // Try alternate base URL if primary failed
      const alternateUrl = this.activeBaseUrl === this.primaryBaseUrl ? this.secondaryBaseUrl : this.primaryBaseUrl;
      try {
        const altResult = await this._requestChat(alternateUrl, payload);
        this.activeBaseUrl = alternateUrl; // Remember working endpoint
        return altResult;
      } catch (altErr) {
        console.warn(`[GeminiAssistant] Alternate backend ${alternateUrl} also failed:`, altErr.message);
        throw altErr;
      }
    }
  }

  async _requestChat(baseUrl, payload) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    try {
      const response = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }
}

window.GeminiAssistant = new GeminiAssistantClient();
