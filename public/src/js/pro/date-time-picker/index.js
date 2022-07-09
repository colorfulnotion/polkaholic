import { getjQuery, element, getUID, typeCheckConfig } from '../../mdb/util/index';
import { getDelimeters, parseDate, isValidDate, isValidTime } from './utils';
import { ICON_BUTTONS, TOGGLE_BUTTON } from './templates';
import Data from '../../mdb/dom/data';
import EventHandler from '../../mdb/dom/event-handler';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import Datepicker from '../datepicker/index';
import Timepicker from '../timepicker';

const NAME = 'datetimepicker';
const DATA_KEY = `mdb.${NAME}`;
const EVENT_KEY = `.${DATA_KEY}`;

const CLASSNAME_DATEPICKER = 'datepicker';
const CLASSNAME_TIMEPICKER = 'timepicker';
const CLASSNAME_TOGGLE_BUTTON = `${NAME}-toggle-button`;
const CLASSNAME_INVALID_FEEDBACK = 'invalid-feedback';
const CLASSNAME_IS_INVALID = 'is-invalid';
const CLASSNAME_DATETIMEPICKER_OPEN = 'dateTimepicker-open';

const SELECTOR_DATETIMEPICKER = `.${NAME}`;
const SELECTOR_TIMEPICKER = `.${CLASSNAME_TIMEPICKER}`;
const SELECTOR_DATEPICKER = `.${CLASSNAME_DATEPICKER}`;
const SELECTOR_DATA_TOGGLE = `[data-mdb-toggle="${NAME}"]`;
const SELECTOR_TOGGLE_BUTTON = `.${CLASSNAME_TOGGLE_BUTTON}`;
const SELECTOR_INVALID_FEEDBACK = `.${CLASSNAME_INVALID_FEEDBACK}`;

const EVENT_OPEN = `open${EVENT_KEY}`;
const EVENT_CLOSE = `close${EVENT_KEY}`;
const EVENT_DATETIME_CHANGE = `datetimeChange${EVENT_KEY}`;

const EVENT_CLOSE_DATEPICKER = 'close.mdb.datepicker';
const EVENT_INPUT_TIMEPICKER = 'input.mdb.timepicker';
const BUTTONS_WRAPPER = element('div');

const Default = {
  appendValidationInfo: true,
  inline: false,
  toggleButton: true,
  disabled: false,
  defaultTime: '',
  defaultDate: '',
  timepicker: {},
  datepicker: {},
  invalidLabel: 'Invalid Date or Time Format',
  showFormat: false,
};

const DefaultType = {
  appendValidationInfo: 'boolean',
  inline: 'boolean',
  toggleButton: 'boolean',
  disabled: 'boolean',
  defaultTime: '(string|date|number)',
  defaultDate: '(string|date|number)',
  timepicker: 'object',
  datepicker: 'object',
  invalidLabel: 'string',
  showFormat: 'boolean',
};

class Datetimepicker {
  constructor(element, options) {
    this._element = element;
    this._input = SelectorEngine.findOne('input', this._element);
    this._options = this._getConfig(options);
    this._timepicker = null;
    this._datepicker = null;
    this._dateValue = this._options.defaultDate ? this._options.defaultDate : '';
    this._timeValue = this._options.defaultTime ? this._options.defaultTime : '';
    this._isInvalidTimeFormat = false;
    this._validationInfo = null;
    this._format = this._options.datepicker.format ? this._options.datepicker.format : 'dd/mm/yyyy';
    this._cancel = false;

    if (this._element) {
      Data.setData(element, DATA_KEY, this);
    }

    this._init();
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get toggleButton() {
    return SelectorEngine.findOne(SELECTOR_TOGGLE_BUTTON, this._element);
  }

  dispose() {
    EventHandler.off(this._element, 'click', this._openDatePicker);
    EventHandler.off(this._input, 'input', this._handleInput);
    Data.removeData(this._element, DATA_KEY);
    this._element = null;
    this._options = null;
    this._input = null;
    this._timepicker = null;
    this._datepicker = null;
    this._dateValue = null;
    this._timeValue = null;
    this._isInvalidTimeFormat = null;
    this._validationInfo = null;
  }

  // Private

  _init() {
    this._addDatepicker();
    this._addTimePicker();
    this._appendToggleButton();
    this._listenToToggleClick();
    this._listenToUserInput();
    this._disableInput();
    this._setInitialDefaultInput();
    this._appendValidationInfo();
    this._applyFormatPlaceholder();
  }

  _addDatepicker() {
    const DATEPICKER_WRAPPER = element('div');
    DATEPICKER_WRAPPER.id = getUID('datepicker-');

    const DATEPICKER_INPUT = '<input type="text" class="form-control">';
    DATEPICKER_WRAPPER.innerHTML = DATEPICKER_INPUT;

    Manipulator.addClass(DATEPICKER_WRAPPER, CLASSNAME_DATEPICKER);
    this._element.appendChild(DATEPICKER_WRAPPER);
    Manipulator.style(DATEPICKER_WRAPPER, { display: 'none' });

    if (this._options.inline) {
      const options = { ...this._options.datepicker, ...{ inline: true } };
      this._datepicker = new Datepicker(DATEPICKER_WRAPPER, options);
    } else {
      this._datepicker = new Datepicker(DATEPICKER_WRAPPER, this._options.datepicker);
    }
    this._datepicker._input.value = this._dateValue;
  }

  _addTimePicker() {
    const TIMEPICKER_WRAPPER = element('div');
    TIMEPICKER_WRAPPER.id = getUID('timepicker-');

    const TIMEPICKER_INPUT = '<input type="text" class="form-control">';
    TIMEPICKER_WRAPPER.innerHTML = TIMEPICKER_INPUT;

    Manipulator.addClass(TIMEPICKER_WRAPPER, CLASSNAME_TIMEPICKER);
    this._element.appendChild(TIMEPICKER_WRAPPER);
    Manipulator.style(TIMEPICKER_WRAPPER, { display: 'none' });

    if (this._options.inline) {
      const options = { ...this._options.timepicker, ...{ inline: true } };
      this._timepicker = new Timepicker(TIMEPICKER_WRAPPER, options);
    } else {
      this._timepicker = new Timepicker(TIMEPICKER_WRAPPER, this._options.timepicker);
    }
    this._timepicker.input.value = this._timeValue;
  }

  _addIconButtons() {
    Manipulator.addClass(BUTTONS_WRAPPER, 'buttons-container');
    BUTTONS_WRAPPER.innerHTML = ICON_BUTTONS;

    if (this._options.inline) {
      return;
    }

    if (this._datepicker._isOpen) {
      const headerDate = SelectorEngine.findOne(`${SELECTOR_DATEPICKER}-header`, document.body);
      headerDate.appendChild(BUTTONS_WRAPPER);
    } else if (this._timepicker._modal) {
      const header = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-elements`, document.body);
      const headerTime = SelectorEngine.findOne(
        `${SELECTOR_TIMEPICKER}-clock-wrapper`,
        document.body
      );
      header.insertBefore(BUTTONS_WRAPPER, headerTime);
    }
  }

  _appendToggleButton() {
    if (!this._options.toggleButton) {
      return;
    }

    this._element.insertAdjacentHTML('beforeend', TOGGLE_BUTTON);

    if (this._options.disabled) {
      this.toggleButton.disabled = true;
      this.toggleButton.style.pointerEvents = 'none';
    }
  }

  _appendValidationInfo() {
    const { invalidLabel, appendValidationInfo } = this._options;

    if (appendValidationInfo) {
      this._validationInfo = element('div');
      Manipulator.addClass(this._validationInfo, CLASSNAME_INVALID_FEEDBACK);
      this._validationInfo.innerHTML = invalidLabel;

      Manipulator.addStyle(this._input, { marginBottom: 0 });
      Manipulator.addStyle(this._validationInfo, { bottom: '-23px' });
    }
  }

  _applyFormatPlaceholder() {
    if (this._options.showFormat) {
      this._input.placeholder = this._format;
    }
  }

  _listenToCancelClick() {
    const DATEPICKER_CANCEL_BTN = SelectorEngine.findOne(
      `${SELECTOR_DATEPICKER}-cancel-btn`,
      document.body
    );

    EventHandler.one(DATEPICKER_CANCEL_BTN, 'mousedown', () => {
      Manipulator.removeClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
      this._cancel = true;
      EventHandler.off(DATEPICKER_CANCEL_BTN, 'mousedown');
    });
  }

  _listenToToggleClick() {
    EventHandler.on(this._element, 'click', SELECTOR_DATA_TOGGLE, (event) => {
      event.preventDefault();
      this._openDatePicker();
    });
  }

  _listenToUserInput() {
    EventHandler.on(this._input, 'input', (event) => {
      this._handleInput(event.target.value);
    });
  }

  _disableInput() {
    if (this._options.disabled) {
      this._input.disabled = 'true';
    }
  }

  _getConfig(config) {
    const dataAttributes = Manipulator.getDataAttributes(this._element);

    config = {
      ...Default,
      ...dataAttributes,
      ...config,
    };

    typeCheckConfig(NAME, config, DefaultType);
    return config;
  }

  _handleInput(input) {
    const dateTimeSplited = input.split(', ');
    const dateDelimeters = getDelimeters(this._format);

    const inputFirstValue = dateTimeSplited[0];
    const inputSecondValue = dateTimeSplited[1] || '';

    const date = parseDate(inputFirstValue, this._format, dateDelimeters);

    if (!inputFirstValue) {
      this._removeInvalidClass(this._input);
    } else if (dateTimeSplited.length === 2) {
      const isInputValid = isValidDate(date) && isValidTime(inputSecondValue);

      if (isInputValid) {
        this._dateValue = inputFirstValue;
        this._timeValue = inputSecondValue;
        this._removeInvalidClass(this._input);
        this._datepicker._input.value = this._dateValue;
        this._timepicker.input.value = this._timeValue;
      } else {
        this._addInvalidClass(this._input, this._validationInfo);
      }
    } else {
      this._addInvalidClass(this._input, this._validationInfo);
    }
  }

  _addInvalidClass() {
    const { appendValidationInfo } = this._options;
    if (appendValidationInfo) {
      Manipulator.addClass(this._input, CLASSNAME_IS_INVALID);

      if (!SelectorEngine.findOne(SELECTOR_INVALID_FEEDBACK)) {
        this._input.parentNode.insertBefore(this._validationInfo, this._input.nextSibling);
      }
    }
  }

  _removeInvalidClass(input) {
    Manipulator.removeClass(input, CLASSNAME_IS_INVALID);
    this._isInvalidTimeFormat = false;
    const allInvalid = SelectorEngine.findOne(SELECTOR_INVALID_FEEDBACK);

    if (allInvalid === null) {
      return;
    }
    allInvalid.remove();
  }

  _openDatePicker() {
    const openEvent = EventHandler.trigger(this._element, EVENT_OPEN);

    if (openEvent.defaultPrevented) {
      return;
    }

    this._datepicker.open();

    if (!this._options.inline) {
      Manipulator.addClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
    }

    if (this._options.inline) {
      this._openDropdownDate();
    }
    this._addIconButtons();

    this._listenToCancelClick();

    if (this._options.inline && this._datepicker._isOpen) {
      this.toggleButton.style.pointerEvents = 'none';
    }

    EventHandler.one(this._datepicker._element, EVENT_CLOSE_DATEPICKER, () => {
      this._dateValue = this._datepicker._input.value;
      this._updateInputValue();

      if (this._cancel) {
        this._cancel = false;
        return;
      }

      EventHandler.on(this._datepicker.container, 'click', () => {
        this._openTimePicker();
      });
      setTimeout(() => {
        const timepicker = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-wrapper`, document.body);
        if (!timepicker) {
          Manipulator.removeClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
        }
      }, 10);
      if (this._options.inline) {
        this.toggleButton.style.pointerEvents = 'auto';
      }
    });

    const CLOCK_BTN = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-button-toggle`, document.body);
    EventHandler.on(CLOCK_BTN, 'click', () => {
      this._datepicker.close();
      EventHandler.trigger(this._datepicker._element, EVENT_CLOSE_DATEPICKER);
    });
  }

  _handleEscapeKey() {
    EventHandler.one(document.body, 'keyup', () => {
      setTimeout(() => {
        const timepicker = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-wrapper`, document.body);
        if (!timepicker) {
          Manipulator.removeClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
        }
      }, 250);
    });
  }

  _handleCancelButton() {
    const CANCEL_BTN = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-cancel`, document.body);
    EventHandler.one(CANCEL_BTN, 'mousedown', () => {
      Manipulator.removeClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
    });
  }

  _openDropdownDate() {
    const datePopper = this._datepicker._popper;
    datePopper.state.elements.reference = this._input;
  }

  _openTimePicker() {
    EventHandler.trigger(this._timepicker.elementToggle, 'click');
    setTimeout(() => {
      this._addIconButtons();

      if (this._options.inline) {
        this._openDropdownTime();
      }
      if (this._timepicker._modal) {
        const CANCEL_BTN = SelectorEngine.findOne(`${SELECTOR_TIMEPICKER}-cancel`, document.body);
        this._handleEscapeKey();
        this._handleCancelButton();
        EventHandler.on(this._timepicker._modal, 'click', (e) => {
          if (
            e.target.classList.contains(`${CLASSNAME_TIMEPICKER}-wrapper`) ||
            e.target.classList.contains(`${CLASSNAME_TIMEPICKER}-submit`)
          ) {
            setTimeout(() => {
              Manipulator.removeClass(document.body, CLASSNAME_DATETIMEPICKER_OPEN);
            }, 200);
          }
          if (e.target.classList.contains(`${CLASSNAME_TIMEPICKER}-clear`)) {
            EventHandler.trigger(this._timepicker._element, EVENT_INPUT_TIMEPICKER);
          }
          if (e.target.classList.contains(`${CLASSNAME_DATEPICKER}-button-toggle`)) {
            EventHandler.trigger(CANCEL_BTN, 'click');
            setTimeout(() => {
              this._openDatePicker();
            }, 200);
          }
        });
      }
    });

    EventHandler.one(this._timepicker._element, EVENT_INPUT_TIMEPICKER, () => {
      this._timeValue = this._timepicker.input.value;
      this._updateInputValue();
      EventHandler.trigger(this._element, EVENT_CLOSE);
    });
  }

  _openDropdownTime() {
    const timePopper = this._timepicker._popper;
    timePopper.state.elements.reference = this._input;
    timePopper.update();
  }

  _setInitialDefaultInput() {
    const shouldUpdate = this._options.defaultDate || this._options.defaultTime;

    if (shouldUpdate) {
      this._updateInputValue();
    }
  }

  _updateInputValue() {
    const isDateTimeFilled = this._timeValue && this._dateValue;

    if (isDateTimeFilled) {
      this._input.value = `${this._dateValue}, ${this._timeValue}`;

      const changeEvent = EventHandler.trigger(this._element, EVENT_DATETIME_CHANGE);

      if (changeEvent.defaultPrevented) {
        return;
      }
    }

    EventHandler.trigger(this._input, 'focus');
  }

  // static

  static jQueryInterface(config, options) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose/.test(config)) {
        return;
      }

      if (!data) {
        data = new Datetimepicker(this, _config);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config](options);
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

SelectorEngine.find(SELECTOR_DATETIMEPICKER).forEach((datetimepicker) => {
  let instance = Datetimepicker.getInstance(datetimepicker);
  if (!instance) {
    instance = new Datetimepicker(datetimepicker);
  }
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 * add .datetimepicker to jQuery only if jQuery is present
 */

const $ = getjQuery();

if ($) {
  const JQUERY_NO_CONFLICT = $.fn[NAME];

  $.fn[NAME] = Datetimepicker.jQueryInterface;
  $.fn[NAME].Constructor = Datetimepicker;
  $.fn[NAME].noConflict = () => {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Datetimepicker.jQueryInterface;
  };
}

export default Datetimepicker;
