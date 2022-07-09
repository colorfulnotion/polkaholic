import { createPopper } from '@popperjs/core';
import Data from '../../mdb/dom/data';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import { typeCheckConfig, getjQuery, getUID, onDOMContentLoaded } from '../../mdb/util/index';
import EventHandler from '../../mdb/dom/event-handler';
import {
  getDropdownTemplate,
  getItemsTemplate,
  getLoaderTemplate,
  getNoResultsTemplate,
} from './templates';
import { ESCAPE, UP_ARROW, DOWN_ARROW, HOME, END, ENTER, TAB } from '../../mdb/util/keycodes';
import { sanitizeHtml, DefaultWhitelist } from '../../mdb/util/sanitizer';

const Default = {
  customContent: '',
  debounce: 300,
  displayValue: (value) => value,
  filter: null,
  itemContent: null,
  listHeight: 190,
  noResults: 'No results found',
  threshold: 0,
};

const DefaultType = {
  customContent: 'string',
  debounce: 'number',
  displayValue: 'function',
  filter: '(null|function)',
  itemContent: '(null|function)',
  listHeight: 'number',
  noResults: 'string',
  threshold: 'number',
};

const NAME = 'autocomplete';
const DATA_KEY = 'mdb.autocomplete';

const CLASS_NAME_CUSTOM_INPUT = 'autocomplete-input';
const CLASS_NAME_CUSTOM_LABEL = 'autocomplete-label';
const CLASS_NAME_ACTIVE = 'active';
const CLASS_NAME_FOCUSED = 'focused';
const CLASS_NAME_OPEN = 'open';

const SELECTOR_DROPDOWN = '.autocomplete-dropdown';
const SELECTOR_ITEMS_LIST = '.autocomplete-items-list';
const SELECTOR_ITEM = '.autocomplete-item';
const SELECTOR_LOADER = '.autocomplete-loader';
const SELECTOR_INPUT = '.form-control';
const SELECTOR_LABEL = '.form-label';
const SELECTOR_CUSTOM_CONTENT = '.autocomplete-custom-content';

const EVENT_KEY = `.${DATA_KEY}`;
const EVENT_CLOSE = `close${EVENT_KEY}`;
const EVENT_OPEN = `open${EVENT_KEY}`;
const EVENT_SELECT = `itemSelect${EVENT_KEY}`;
const EVENT_UPDATE = `update${EVENT_KEY}`;

const LOADER_CLOSE_DELAY = 300;

class Autocomplete {
  constructor(element, options) {
    this._element = element;
    this._options = this._getConfig(options);
    this._input = SelectorEngine.findOne(SELECTOR_INPUT, element);
    this._label = SelectorEngine.findOne(SELECTOR_LABEL, element);
    this._customContent = SelectorEngine.findOne(SELECTOR_CUSTOM_CONTENT, element);
    this._loader = getLoaderTemplate();
    this._popper = null;
    this._debounceTimeoutId = null;
    this._loaderTimeout = null;
    this._activeItemIndex = -1;
    this._activeItem = null;
    this._filteredResults = null;
    this._lastQueryValue = null;
    this._canOpenOnFocus = true;
    this._isOpen = false;

    this._outsideClickHandler = this._handleOutsideClick.bind(this);
    this._inputFocusHandler = this._handleInputFocus.bind(this);
    this._userInputHandler = this._handleUserInput.bind(this);
    this._keydownHandler = this._handleKeydown.bind(this);

    if (element) {
      Data.setData(element, DATA_KEY, this);
    }

    this._init();
  }

  static get NAME() {
    return NAME;
  }

  get filter() {
    return this._options.filter;
  }

  get dropdown() {
    return SelectorEngine.findOne(SELECTOR_DROPDOWN, this._dropdownContainer);
  }

  get items() {
    return SelectorEngine.find(SELECTOR_ITEM, this._dropdownContainer);
  }

  get itemsList() {
    return SelectorEngine.findOne(SELECTOR_ITEMS_LIST, this._dropdownContainer);
  }

  initSearch(value) {
    this._filterResults(value);
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

  _init() {
    this._initDropdown();
    this._setInputAndLabelClasses();
    this._updateLabelPosition();
    this._setInputAriaAttributes();
    this._listenToInputFocus();
    this._listenToUserInput();
    this._listenToKeydown();
  }

  _initDropdown() {
    this._dropdownContainerId = getUID('autocomplete-dropdown-');
    const settings = {
      id: this._dropdownContainerId,
      items: [],
      width: this._input.offsetWidth,
      options: this._options,
    };

    this._dropdownContainer = getDropdownTemplate(settings);

    if (this._options.customContent !== '') {
      const customContent = this._options.customContent;
      const sanitizedCustomContent = sanitizeHtml(customContent, DefaultWhitelist, null);
      this.dropdown.insertAdjacentHTML('beforeend', sanitizedCustomContent);
    }
  }

  _setInputAndLabelClasses() {
    Manipulator.addClass(this._input, CLASS_NAME_CUSTOM_INPUT);

    if (this._label) {
      Manipulator.addClass(this._label, CLASS_NAME_CUSTOM_LABEL);
    }
  }

  _setInputAriaAttributes() {
    this._input.setAttribute('role', 'combobox');
    this._input.setAttribute('aria-expanded', false);
    this._input.setAttribute('aria-owns', this._dropdownContainerId);
    this._input.setAttribute('aria-haspoup', true);
    this._input.setAttribute('autocomplete', 'off');
  }

  _updateLabelPosition() {
    if (!this._label) {
      return;
    }

    if (this._input.value !== '' || this._isOpen) {
      Manipulator.addClass(this._label, CLASS_NAME_ACTIVE);
    } else {
      Manipulator.removeClass(this._label, CLASS_NAME_ACTIVE);
    }
  }

  _listenToInputFocus() {
    EventHandler.on(this._input, 'focus', this._inputFocusHandler);
  }

  _handleInputFocus(event) {
    const { value } = event.target;
    const threshold = this._options.threshold;

    if (!this._canOpenOnFocus) {
      this._canOpenOnFocus = true;
      return;
    }

    if (value.length < threshold) {
      return;
    }

    if (this._lastQueryValue !== value) {
      this._filterResults(value);
    } else {
      this.open();
    }
  }

  _listenToWindowResize() {
    EventHandler.on(window, 'resize', this._handleWindowResize.bind(this));
  }

  _handleWindowResize() {
    if (this._dropdownContainer) {
      this._updateDropdownWidth();
    }
  }

  _updateDropdownWidth() {
    const inputWidth = this._input.offsetWidth;
    Manipulator.addStyle(this._dropdownContainer, { width: `${inputWidth}px` });
  }

  _listenToUserInput() {
    EventHandler.on(this._input, 'input', this._userInputHandler);
  }

  _handleUserInput(event) {
    const { value } = event.target;
    const threshold = this._options.threshold;
    const debounceTime = this._options.debounce;

    if (!this.filter) {
      return;
    }

    if (value.length < threshold) {
      if (this._isOpen) {
        this.close();
      }
      return;
    }

    this._debounceFilter(value, debounceTime);
  }

  _debounceFilter(searchTerm, debounceTime) {
    if (this._debounceTimeoutId) {
      clearTimeout(this._debounceTimeoutId);
    }

    this._debounceTimeoutId = setTimeout(() => {
      this._filterResults(searchTerm);
    }, debounceTime);
  }

  _filterResults(value) {
    this._lastQueryValue = value;
    const data = this.filter(value);

    if (this._isPromise(data)) {
      this._asyncUpdateResults(data);
    } else {
      this._updateResults(data);
    }
  }

  _isPromise(value) {
    return !!value && typeof value.then === 'function';
  }

  _asyncUpdateResults(data) {
    this._resetActiveItem();
    this._showLoader();

    data.then((items) => {
      this._updateResults(items);

      this._loaderTimeout = setTimeout(() => {
        this._hideLoader();
        this._loaderTimeout = null;
      }, LOADER_CLOSE_DELAY);
    });
  }

  _resetActiveItem() {
    const currentActive = this._activeItem;

    if (currentActive) {
      Manipulator.removeClass(currentActive, 'active');
      this._activeItem = null;
      this._activeItemIndex = -1;
    }
  }

  _showLoader() {
    this._element.appendChild(this._loader);
  }

  _hideLoader() {
    const loader = SelectorEngine.findOne(SELECTOR_LOADER, this._element);

    if (loader) {
      this._element.removeChild(this._loader);
    }
  }

  _updateResults(data) {
    this._resetActiveItem();
    this._filteredResults = data;
    EventHandler.trigger(this._element, EVENT_UPDATE, { results: data });

    const itemsList = SelectorEngine.findOne('.autocomplete-items-list', this._dropdownContainer);
    const newTemplate = getItemsTemplate(data, this._options);
    const noResultsTemplate = getNoResultsTemplate(this._options.noResults);

    if (data.length === 0 && this._options.noResults !== '') {
      itemsList.innerHTML = noResultsTemplate;
    } else {
      itemsList.innerHTML = newTemplate;
    }

    if (!this._isOpen) {
      this.open();
    }

    this._popper.forceUpdate();
  }

  _listenToKeydown() {
    EventHandler.on(this._element, 'keydown', this._keydownHandler);
  }

  _handleKeydown(event) {
    if (this._isOpen) {
      this._handleOpenKeydown(event);
    } else {
      this._handleClosedKeydown(event);
    }
  }

  _handleOpenKeydown(event) {
    const key = event.keyCode;
    const isCloseKey = key === ESCAPE || (key === UP_ARROW && event.altKey) || key === TAB;

    if (isCloseKey) {
      this.close();
      this._input.focus();
      return;
    }

    switch (key) {
      case DOWN_ARROW:
        this._setActiveItem(this._activeItemIndex + 1);
        this._scrollToItem(this._activeItem);
        break;
      case UP_ARROW:
        this._setActiveItem(this._activeItemIndex - 1);
        this._scrollToItem(this._activeItem);
        break;
      case HOME:
        this._setActiveItem(0);
        this._scrollToItem(this._activeItem);
        break;
      case END:
        this._setActiveItem(this.items.length - 1);
        this._scrollToItem(this._activeItem);
        break;
      case ENTER:
        if (this._activeItemIndex > -1) {
          const item = this._filteredResults[this._activeItemIndex];
          this._handleSelection(item);
        }
        return;
      default:
        return;
    }

    event.preventDefault();
  }

  _setActiveItem(index) {
    const items = this.items;

    if (!items[index]) {
      return;
    }

    this._updateActiveItem(items[index], index);
  }

  _updateActiveItem(newActiveItem, index) {
    const currentActiveItem = this._activeItem;

    if (currentActiveItem) {
      Manipulator.removeClass(currentActiveItem, 'active');
    }

    Manipulator.addClass(newActiveItem, 'active');
    this._activeItemIndex = index;
    this._activeItem = newActiveItem;
  }

  _scrollToItem(item) {
    if (!item) {
      return;
    }

    const list = this.itemsList;
    const listHeight = list.offsetHeight;
    const itemIndex = this.items.indexOf(item);
    const itemHeight = item.offsetHeight;
    const scrollTop = list.scrollTop;

    if (itemIndex > -1) {
      const itemOffset = itemIndex * itemHeight;
      const isBelow = itemOffset + itemHeight > scrollTop + listHeight;
      const isAbove = itemOffset < scrollTop;

      if (isAbove) {
        list.scrollTop = itemOffset;
      } else if (isBelow) {
        list.scrollTop = itemOffset - listHeight + itemHeight;
      } else {
        list.scrollTop = scrollTop;
      }
    }
  }

  _handleClosedKeydown(event) {
    const key = event.keyCode;
    const isOpenKey = key === ENTER || key === DOWN_ARROW || key === DOWN_ARROW;

    if (isOpenKey) {
      this.open();
    }
  }

  open() {
    const openEvent = EventHandler.trigger(this._element, EVENT_OPEN);

    if (this._isOpen || openEvent.defaultPrevented) {
      return;
    }
    this._updateDropdownWidth();
    this._listenToWindowResize();

    this._popper = createPopper(this._element, this._dropdownContainer);
    document.body.appendChild(this._dropdownContainer);

    this._listenToOutsideClick();
    this._listenToItemsClick();

    // We need to add delay to wait for the popper initialization
    // and position update
    setTimeout(() => {
      Manipulator.addClass(this.dropdown, CLASS_NAME_OPEN);
      this._isOpen = true;
      this._setInputActiveStyles();
      this._updateLabelPosition();
    }, 0);
  }

  _listenToOutsideClick() {
    EventHandler.on(document, 'click', this._outsideClickHandler);
  }

  _handleOutsideClick(event) {
    const isInput = this._input === event.target;
    const isDropdown = event.target === this._dropdownContainer;
    const isDropdownContent =
      this._dropdownContainer && this._dropdownContainer.contains(event.target);

    if (!isInput && !isDropdown && !isDropdownContent) {
      this.close();
    }
  }

  _listenToItemsClick() {
    const itemsList = SelectorEngine.findOne(SELECTOR_ITEMS_LIST, this._dropdownContainer);
    EventHandler.on(itemsList, 'click', this._handleItemsClick.bind(this));
  }

  _handleItemsClick(event) {
    const target = SelectorEngine.closest(event.target, SELECTOR_ITEM);
    const targetIndex = Manipulator.getDataAttribute(target, 'index');
    const item = this._filteredResults[targetIndex];

    this._handleSelection(item);
  }

  _handleSelection(item) {
    const value = this._options.displayValue(item);
    const selectEvent = EventHandler.trigger(this._element, EVENT_SELECT, { value: item });

    if (selectEvent.defaultPrevented) {
      return;
    }

    setTimeout(() => {
      this._canOpenOnFocus = false;
      this._updateInputValue(value);
      this._updateLabelPosition();
      this._input.focus();
      this.close();
    }, 0);
  }

  _updateInputValue(value) {
    this._input.value = value;
  }

  _setInputActiveStyles() {
    Manipulator.addClass(this._input, CLASS_NAME_FOCUSED);
  }

  close() {
    const closeEvent = EventHandler.trigger(this._element, EVENT_CLOSE);

    if (!this._isOpen || closeEvent.defaultPrevented) {
      return;
    }

    this._resetActiveItem();
    this._removeDropdownEvents();

    Manipulator.removeClass(this.dropdown, CLASS_NAME_OPEN);

    EventHandler.on(this.dropdown, 'transitionend', this._handleDropdownTransitionEnd.bind(this));

    Manipulator.removeClass(this._input, CLASS_NAME_FOCUSED);
    Manipulator.removeClass(this._input, CLASS_NAME_ACTIVE);

    if (!this._input.value) {
      Manipulator.removeClass(this._label, CLASS_NAME_ACTIVE);
    }
  }

  _removeDropdownEvents() {
    const itemsList = SelectorEngine.findOne(SELECTOR_ITEMS_LIST, this._dropdownContainer);
    EventHandler.off(itemsList, 'click');
    EventHandler.off(document, 'click', this._outsideClickHandler);
    EventHandler.off(window, 'resize', this._handleWindowResize.bind(this));
  }

  _handleDropdownTransitionEnd(event) {
    // This event fires for each animated property. We only want
    // to run this code once
    if (this._isOpen && event && event.propertyName === 'opacity') {
      this._popper.destroy();

      if (this._dropdownContainer) {
        document.body.removeChild(this._dropdownContainer);
      }

      this._isOpen = false;
      EventHandler.off(this.dropdown, 'transitionend');
    }
  }

  dispose() {
    if (this._isOpen) {
      this.close();
    }

    this._removeInputAndElementEvents();

    Data.removeData(this._element, DATA_KEY);
  }

  _removeInputAndElementEvents() {
    EventHandler.off(this._input, 'focus', this._inputFocusHandler);
    EventHandler.off(this._input, 'input', this._userInputHandler);
    EventHandler.off(this._element, 'keydown', this._keydownHandler);
  }

  static jQueryInterface(config, options) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose/.test(config)) {
        return;
      }

      if (!data) {
        data = new Autocomplete(this, _config);
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

export default Autocomplete;

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 * add .timepicker to jQuery only if jQuery is present
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Autocomplete.jQueryInterface;
    $.fn[NAME].Constructor = Autocomplete;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Autocomplete.jQueryInterface;
    };
  }
});
