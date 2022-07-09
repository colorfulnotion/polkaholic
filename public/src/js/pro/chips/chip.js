import { element, getjQuery, typeCheckConfig, onDOMContentLoaded } from '../../mdb/util/index';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import Data from '../../mdb/dom/data';
import EventHandler from '../../mdb/dom/event-handler';
import { getChip } from './templates';

/**
 *
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'chip';
const DATA_KEY = `mdb.${NAME}`;
const SELECTOR_CLOSE = '.close';
const EVENT_DELETE = 'delete.mdb.chip';
const EVENT_SELECT = 'select.mdb.chip';

const DefaultType = { text: 'string', closeIcon: 'boolean', img: 'object' };

const Default = { text: '', closeIcon: false, img: { path: '', alt: '' } };

class Chip {
  constructor(element, data = {}) {
    this._element = element;
    this._options = this._getConfig(data);
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  // Public

  init() {
    this._appendCloseIcon();
    this._handleDelete();
    this._handleTextChip();
    this._handleClickOnChip();
  }

  dispose() {
    this._element = null;
    this._options = null;
    EventHandler.off(this._element, 'click');
  }

  appendChip() {
    const { text, closeIcon } = this._options;
    const chip = getChip({ text, closeIcon });

    return chip;
  }

  // Private

  _appendCloseIcon(el = this._element) {
    if (SelectorEngine.find(SELECTOR_CLOSE, this._element).length > 0) return;

    if (this._options.closeIcon) {
      const createIcon = element('i');
      createIcon.classList = 'close fas fa-times';

      el.insertAdjacentElement('beforeend', createIcon);
    }
  }

  _handleClickOnChip() {
    EventHandler.on(this._element, 'click', (event) => {
      const { textContent } = event.target;
      const obj = {};

      obj.tag = textContent.trim();

      EventHandler.trigger(EVENT_SELECT, { event, obj });
    });
  }

  _handleDelete() {
    const deleteElement = SelectorEngine.find(SELECTOR_CLOSE, this._element);
    if (deleteElement.length === 0) return;

    EventHandler.on(this._element, 'click', SELECTOR_CLOSE, (e) => {
      EventHandler.trigger(EVENT_DELETE, e);
      this._element.remove();
    });
  }

  _handleTextChip() {
    if (this._element.innerText !== '') return;

    this._element.innerText = this._options.text;
  }

  _getConfig(options) {
    const config = {
      ...Default,
      ...Manipulator.getDataAttributes(this._element),
      ...options,
    };
    typeCheckConfig(NAME, config, DefaultType);
    return config;
  }

  static jQueryInterface(config) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose|hide/.test(config)) {
        return;
      }

      if (!data) {
        data = new Chip(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config]();
      }
    });
  }

  static getInstance(element) {
    return Data.getData(element, DATA_KEY);
  }

  static getOrCreateInstance(element, config = {}) {
    return (
      this.getInstance(element) || new this(element, typeof config === 'object' ? config : null)
    );
  }
}

/**
 * ------------------------------------------------------------------------
 * Data Api implementation - auto initialization
 * ------------------------------------------------------------------------
 */

SelectorEngine.find(`.${NAME}`).forEach((chip) => {
  let instance = Chip.getInstance(chip);
  if (!instance) {
    instance = new Chip(chip);
  }
  return instance.init();
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Chip.jQueryInterface;
    $.fn[NAME].Constructor = Chip;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Chip.jQueryInterface;
    };
  }
});

export default Chip;
