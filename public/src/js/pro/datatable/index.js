import PerfectScrollbar from '../../mdb/perfect-scrollbar';
import { getjQuery, typeCheckConfig, onDOMContentLoaded } from '../../mdb/util/index';
import Data from '../../mdb/dom/data';
import EventHandler from '../../mdb/dom/event-handler';
import Manipulator from '../../mdb/dom/manipulator';
import SelectorEngine from '../../mdb/dom/selector-engine';
import tableTemplate from './html/table'; //eslint-disable-line
import { search, sort, paginate } from './util';
import Select from '../select';

/**
 * ------------------------------------------------------------------------
 * Constants
 * ------------------------------------------------------------------------
 */

const NAME = 'datatable';
const DATA_KEY = 'mdb.datatable';

const CLASS_DATATABLE = 'datatable';
const CLASS_FIXED_CELL = 'fixed-cell';

const SELECTOR_DATATABLE = '.datatable';
const SELECTOR_BODY = '.datatable-inner';
const SELECTOR_CELL = 'td';
const SELECTOR_HEADER = '.datatable-header th';
const SELECTOR_HEADER_CHECKBOX = '.datatable-header-checkbox';
const SELECTOR_PAGINATION_RIGHT = '.datatable-pagination-right';
const SELECTOR_PAGINATION_LEFT = '.datatable-pagination-left';
const SELECTOR_PAGINATION_START = '.datatable-pagination-start';
const SELECTOR_PAGINATION_END = '.datatable-pagination-end';
const SELECTOR_PAGINATION_NAV = '.datatable-pagination-nav';
const SELECTOR_SELECT = '.datatable-select';
const SELECTOR_SORT_ICON = '.datatable-sort-icon';
const SELECTOR_ROW = '.datatable-body tr';
const SELECTOR_ROW_CHECKBOX = '.datatable-row-checkbox';

const EVENT_SELECT = 'selectRows.mdb.datatable';
const EVENT_RENDER = 'render.mdb.datatable';
const EVENT_ROW_CLICK = 'rowClick.mdb.datatable';
const EVENT_UPDATE = 'update.mdb.datatable';

const TYPE_OPTIONS = {
  bordered: 'boolean',
  borderless: 'boolean',
  borderColor: '(string|null)',
  clickableRows: 'boolean',
  color: '(string|null)',
  defaultValue: 'string',
  edit: 'boolean',
  entries: 'number',
  entriesOptions: 'array',
  fullPagination: 'boolean',
  hover: 'boolean',
  loading: 'boolean',
  loadingMessage: 'string',
  maxWidth: '(null|number|string)',
  maxHeight: '(null|number|string)',
  multi: 'boolean',
  noFoundMessage: 'string',
  pagination: 'boolean',
  selectable: 'boolean',
  sm: 'boolean',
  sortField: '(null|string)',
  sortOrder: 'string',
  loaderClass: 'string',
  fixedHeader: 'boolean',
  striped: 'boolean',
  rowsText: 'string',
};

const TYPE_COLUMN_FIELDS = {
  label: 'string',
  field: 'string',
  fixed: '(boolean|string)',
  format: '(function|null)',
  width: '(number|null)',
  sort: 'boolean',
  columnIndex: 'number',
};

const DEFAULT_OPTIONS = {
  bordered: false,
  borderless: false,
  borderColor: null,
  clickableRows: false,
  color: null,
  dark: false,
  defaultValue: '-',
  edit: false,
  entries: 10,
  entriesOptions: [10, 25, 50, 200],
  fixedHeader: false,
  fullPagination: false,
  hover: false,
  loaderClass: 'bg-primary',
  loading: false,
  loadingMessage: 'Loading results...',
  maxWidth: null,
  maxHeight: null,
  multi: false,
  noFoundMessage: 'No matching results found',
  pagination: true,
  selectable: false,
  sm: false,
  sortField: null,
  sortOrder: 'asc',
  striped: false,
  rowsText: 'Rows per page:',
};

const DEFAUL_COLUMN = {
  label: '',
  field: '',
  fixed: false,
  format: null,
  width: null,
  sort: true,
  columnIndex: 0,
};

/**
 * ------------------------------------------------------------------------
 * Class Definition
 * ------------------------------------------------------------------------
 */

class Datatable {
  constructor(element, data = {}, options = {}) {
    this._element = element;

    this._options = this._getOptions(options);

    this._sortField = this._options.sortField;
    this._sortOrder = this._options.sortOrder;
    this._sortReverse = false;

    this._activePage = 0;

    this._search = '';
    this._searchColumn = null;

    this._paginationLeft = null;
    this._paginationRight = null;
    this._paginationStart = null;
    this._paginationEnd = null;
    this._select = null;
    this._selectInstance = null;

    this._selected = [];
    this._checkboxes = null;
    this._headerCheckbox = null;

    this._rows = this._getRows(data.rows);
    this._columns = this._getColumns(data.columns);

    if (this._element) {
      Data.setData(element, DATA_KEY, this);

      this._perfectScrollbar = null;
      this._setup();
    }
  }

  // Getters

  static get NAME() {
    return NAME;
  }

  get columns() {
    return this._columns.map((column, index) => {
      let template = {
        ...DEFAUL_COLUMN,
        field: `field_${index}`,
        columnIndex: index,
      };

      if (typeof column === 'string') {
        template.label = column;
      } else if (typeof column === 'object') {
        template = {
          ...template,
          ...column,
        };
      }

      typeCheckConfig('column', template, TYPE_COLUMN_FIELDS);

      return template;
    });
  }

  get rows() {
    return this._rows.map((row, index) => {
      const output = {
        rowIndex: index,
      };

      if (Array.isArray(row)) {
        this.columns.forEach((column, i) => {
          output[column.field] = row[i] || this._options.defaultValue;
        });
      } else if (typeof row === 'object') {
        this.columns.forEach((column) => {
          output[column.field] = row[column.field] || this._options.defaultValue;
        });
      }

      return output;
    });
  }

  get searchResult() {
    return search(this.rows, this._search, this._searchColumn);
  }

  get computedRows() {
    let result = [...this.searchResult];

    if (this._sortOrder) {
      result = sort({ rows: result, field: this._sortField, order: this._sortOrder });
    }

    if (this._options.pagination) {
      result = paginate({
        rows: result,
        entries: this._options.entries,
        activePage: this._activePage,
      });
    }
    return result;
  }

  get pages() {
    return Math.ceil(this.rows.length / this._options.entries);
  }

  get navigationText() {
    const firstVisibleEntry = this._activePage * this._options.entries;
    return `${firstVisibleEntry + 1} - ${this.computedRows.length + firstVisibleEntry} of ${
      this.searchResult.length
    }`;
  }

  get classNames() {
    return [
      CLASS_DATATABLE,
      this._options.color,
      this._options.borderColor && `border-${this._options.borderColor}`,
      this._options.dark && 'datatable-dark',
      this._options.hover && 'datatable-hover',
      this._options.bordered && 'datatable-bordered',
      this._options.borderless && 'datatable-borderless',
      this._options.sm && 'datatable-sm',
      this._options.striped && 'datatable-striped',
      this._options.loading && 'datatable-loading',
      this._options.clickableRows && 'datatable-clickable-rows',
    ].filter((className) => className);
  }

  get tableOptions() {
    return {
      columns: this.columns,
      rows: this.computedRows,
      noFoundMessage: this._options.noFoundMessage,
      edit: this._options.edit,
      loading: this._options.loading,
      loaderClass: this._options.loaderClass,
      loadingMessage: this._options.loadingMessage,
      selectable: this._options.selectable,
      multi: this._options.multi,
      pagination: {
        enable: this._options.pagination,
        text: this.navigationText,
        entries: this._options.entries,
        entriesOptions: this._options.entriesOptions,
        fullPagination: this._options.fullPagination,
        rowsText: this._options.rowsText,
      },
    };
  }

  // Public

  update(data, options = {}) {
    if (data && data.rows) {
      this._rows = data.rows;
    }

    if (data && data.columns) {
      this._columns = data.columns;
    }

    this._clearClassList(options);

    this._options = this._getOptions({ ...this._options, ...options });

    this._setup();
  }

  dispose() {
    if (this._selectInstance) {
      this._selectInstance.dispose();
    }

    Data.removeData(this._element, DATA_KEY);

    this._removeEventListeners();

    this._perfectScrollbar.destroy();

    this._element = null;
  }

  search(string, column) {
    this._search = string;

    this._searchColumn = column;

    this._activePage = 0;

    this._toggleDisableState();

    this._renderRows();
  }

  sort(column, order = 'asc') {
    this._sortOrder = order;

    if (typeof column === 'string') {
      this._sortField = this.columns.find((header) => header.label === column).field;
    } else {
      this._sortField = column.field;
    }

    const icon = SelectorEngine.findOne(`i[data-mdb-sort="${this._sortField}"]`, this._element);

    this._activePage = 0;

    this._toggleDisableState();

    this._renderRows();

    this._setActiveSortIcon(icon);
  }

  // Private

  _changeActivePage(index) {
    this._activePage = index;

    this._toggleDisableState();

    this._renderRows();
  }

  _clearClassList(options) {
    if (this._options.color && options.color) {
      Manipulator.removeClass(this._element, this._options.color);
    }

    if (this._options.borderColor && options.borderColor) {
      Manipulator.removeClass(this._element, `border-${this._options.borderColor}`);
    }

    ['dark', 'hover', 'bordered', 'borderless', 'sm', 'striped', 'loading'].forEach((option) => {
      if (this._options[option] && !options[option]) {
        Manipulator.removeClass(this._element, `datatable-${option}`);
      }
    });
  }

  _emitSelectEvent() {
    EventHandler.trigger(this._element, EVENT_SELECT, {
      selectedRows: this.rows.filter((row) => this._selected.indexOf(row.rowIndex) !== -1),
      selectedIndexes: this._selected,
      allSelected: this._selected.length === this.rows.length,
    });
  }

  _getRows(rows = []) {
    const body = SelectorEngine.findOne('tbody', this._element);

    if (!body) {
      return rows;
    }

    const tableRows = SelectorEngine.find('tr', body).map((row) => {
      return SelectorEngine.find('td', row).map((cell) => cell.innerHTML);
    });

    return [...tableRows, ...rows];
  }

  _getColumns(columns = []) {
    const head = SelectorEngine.findOne('thead', this._element);

    if (!head) {
      return columns;
    }

    const headerRow = SelectorEngine.findOne('tr', head);

    const headers = SelectorEngine.find('th', headerRow).map((cell) => ({
      label: cell.innerHTML,
      ...Manipulator.getDataAttributes(cell),
    }));

    return [...headers, ...columns];
  }

  _getCSSValue(size) {
    if (typeof size === 'string') {
      return size;
    }

    return `${size}px`;
  }

  _getOptions(options) {
    const config = {
      ...DEFAULT_OPTIONS,
      ...Manipulator.getDataAttributes(this._element),
      ...options,
    };

    typeCheckConfig(NAME, config, TYPE_OPTIONS);
    return config;
  }

  _setActiveRows() {
    SelectorEngine.find(SELECTOR_ROW, this._element).forEach((row) => {
      if (this._selected.includes(Manipulator.getDataAttribute(row, 'index'))) {
        Manipulator.addClass(row, 'active');
      } else {
        Manipulator.removeClass(row, 'active');
      }
    });
  }

  _setEntries(e) {
    this._options = this._getOptions({ ...this._options, entries: Number(e.target.value) });

    if (this._activePage > this.pages - 1) {
      this._activePage = this.pages - 1;
    }

    this._toggleDisableState();

    this._renderRows();
  }

  _setSelected() {
    SelectorEngine.find(SELECTOR_ROW_CHECKBOX, this._element).forEach((checkbox) => {
      const index = Manipulator.getDataAttribute(checkbox, 'rowIndex');

      checkbox.checked = this._selected.includes(index);
    });

    this._setActiveRows();
  }

  _setActiveSortIcon(active) {
    SelectorEngine.find(SELECTOR_SORT_ICON, this._element).forEach((icon) => {
      const angle = this._sortOrder === 'desc' && icon === active ? 180 : 0;

      Manipulator.style(icon, {
        transform: `rotate(${angle}deg)`,
      });

      if (icon === active && this._sortOrder) {
        Manipulator.addClass(icon, 'active');
      } else {
        Manipulator.removeClass(icon, 'active');
      }
    });
  }

  _setClassNames() {
    this.classNames.forEach((className) => {
      Manipulator.addClass(this._element, className);
    });
  }

  _setup() {
    this._setClassNames();

    this._renderTable();

    if (this._options.pagination) {
      this._setupPagination();
    }

    if (this._options.edit) {
      this._setupEditable();
    }

    if (this._options.clickableRows) {
      this._setupClickableRows();
    }

    if (this._options.selectable) {
      this._setupSelectable();
    }

    this._setupScroll();

    this._setupSort();
  }

  _setupClickableRows() {
    SelectorEngine.find(SELECTOR_ROW, this._element).forEach((row) => {
      const index = Manipulator.getDataAttribute(row, 'index');

      EventHandler.on(row, 'click', (e) => {
        if (!SelectorEngine.matches(e.target, SELECTOR_ROW_CHECKBOX)) {
          EventHandler.trigger(this._element, EVENT_ROW_CLICK, { index, row: this.rows[index] });
        }
      });
    });
  }

  _setupEditable() {
    SelectorEngine.find(SELECTOR_ROW, this._element).forEach((row) => {
      const index = Manipulator.getDataAttribute(row, 'index');

      SelectorEngine.find(SELECTOR_CELL, row).forEach((cell) => {
        EventHandler.on(cell, 'input', (e) => this._updateRow(e, index));
      });
    });
  }

  _setupScroll() {
    const datatableBody = SelectorEngine.findOne(SELECTOR_BODY, this._element);

    const style = {
      overflow: 'auto',
      position: 'relative',
    };

    if (this._options.maxHeight) {
      style.maxHeight = this._getCSSValue(this._options.maxHeight);
    }

    if (this._options.maxWidth) {
      const width = this._getCSSValue(this._options.maxWidth);

      style.maxWidth = width;

      Manipulator.style(this._element, { maxWidth: width });
    }

    Manipulator.style(datatableBody, style);

    if (this._options.fixedHeader) {
      let headers = SelectorEngine.find(SELECTOR_HEADER, this._element);

      if (this._options.selectable) {
        headers = headers.filter((header, index) => {
          Manipulator.addClass(header, CLASS_FIXED_CELL);

          if (this._options.color) {
            Manipulator.addClass(header, this._options.color);
          }

          return index !== 0;
        });
      }

      headers.forEach((header, i) => {
        Manipulator.addClass(header, CLASS_FIXED_CELL);

        if (this.columns[i].fixed) {
          Manipulator.addStyle(header, { zIndex: 4 });
        }

        if (this._options.color) {
          Manipulator.addClass(header, this._options.color);
        }
      });
    }

    this._perfectScrollbar = new PerfectScrollbar(datatableBody);
  }

  _setupSort() {
    SelectorEngine.find(SELECTOR_SORT_ICON, this._element).forEach((icon) => {
      const field = Manipulator.getDataAttribute(icon, 'sort');
      const [header] = SelectorEngine.parents(icon, 'th');
      Manipulator.style(header, { cursor: 'pointer' });

      if (field === this._options.sortField) {
        this._setActiveSortIcon(icon);
      }

      EventHandler.on(header, 'click', () => {
        if (this._sortField === field && this._sortOrder === 'asc') {
          this._sortOrder = 'desc';
        } else if (this._sortField === field && this._sortOrder === 'desc') {
          this._sortOrder = null;
        } else {
          this._sortOrder = 'asc';
        }

        this._sortField = field;

        this._activePage = 0;

        this._toggleDisableState();

        this._renderRows();

        this._setActiveSortIcon(icon);
      });
    });
  }

  _setupSelectable() {
    this._checkboxes = SelectorEngine.find(SELECTOR_ROW_CHECKBOX, this._element);

    this._headerCheckbox = SelectorEngine.findOne(SELECTOR_HEADER_CHECKBOX, this._element);

    EventHandler.on(this._headerCheckbox, 'input', (e) => this._toggleSelectAll(e));

    this._checkboxes.forEach((checkbox) => {
      const rowIndex = Manipulator.getDataAttribute(checkbox, 'rowIndex');

      EventHandler.on(checkbox, 'input', (e) => this._toggleSelectRow(e, rowIndex));
    });
  }

  _setupPagination() {
    this._paginationRight = SelectorEngine.findOne(SELECTOR_PAGINATION_RIGHT, this._element);

    this._paginationLeft = SelectorEngine.findOne(SELECTOR_PAGINATION_LEFT, this._element);

    EventHandler.on(this._paginationRight, 'click', () =>
      this._changeActivePage(this._activePage + 1)
    );

    EventHandler.on(this._paginationLeft, 'click', () =>
      this._changeActivePage(this._activePage - 1)
    );

    if (this._options.fullPagination) {
      this._paginationStart = SelectorEngine.findOne(SELECTOR_PAGINATION_START, this._element);

      this._paginationEnd = SelectorEngine.findOne(SELECTOR_PAGINATION_END, this._element);

      EventHandler.on(this._paginationStart, 'click', () => this._changeActivePage(0));

      EventHandler.on(this._paginationEnd, 'click', () => this._changeActivePage(this.pages - 1));
    }

    this._toggleDisableState();

    this._setupPaginationSelect();
  }

  _setupPaginationSelect() {
    this._select = SelectorEngine.findOne(SELECTOR_SELECT, this._element);

    if (this._selectInstance) {
      this._selectInstance.dispose();
    }

    this._selectInstance = new Select(this._select);

    EventHandler.on(this._select, 'valueChange.mdb.select', (e) => this._setEntries(e));
  }

  _removeEventListeners() {
    if (this._options.pagination) {
      EventHandler.off(this._paginationRight, 'click');

      EventHandler.off(this._paginationLeft, 'click');

      EventHandler.off(this._select, 'valueChange.mdb.select');

      if (this._options.fullPagination) {
        EventHandler.off(this._paginationStart, 'click');

        EventHandler.off(this._paginationEnd, 'click');
      }
    }

    if (this._options.editable) {
      SelectorEngine.find(SELECTOR_CELL, this._element).forEach((cell) => {
        EventHandler.off(cell, 'input');
      });
    }

    if (this._options.clickableRows) {
      SelectorEngine.find(SELECTOR_ROW, this._element).forEach((row) => {
        EventHandler.off(row, 'click');
      });
    }

    SelectorEngine.find(SELECTOR_SORT_ICON, this._element).forEach((icon) => {
      const [header] = SelectorEngine.parents(icon, 'th');

      EventHandler.off(header, 'click');
    });

    if (this._options.selectable) {
      EventHandler.off(this._headerCheckbox, 'input');

      this._checkboxes.forEach((checkbox) => {
        EventHandler.off(checkbox, 'input');
      });
    }
  }

  _renderTable() {
    this._element.innerHTML = tableTemplate(this.tableOptions).table;

    this._formatCells();

    EventHandler.trigger(this._element, EVENT_RENDER);
  }

  _renderRows() {
    const body = SelectorEngine.findOne('tbody', this._element);

    if (this._options.pagination) {
      const navigation = SelectorEngine.findOne(SELECTOR_PAGINATION_NAV, this._element);

      navigation.innerText = this.navigationText;
    }

    body.innerHTML = tableTemplate(this.tableOptions).rows;

    this._formatCells();

    if (this._options.edit) {
      this._setupEditable();
    }

    if (this._options.selectable) {
      this._setupSelectable();

      this._setSelected();
    }

    if (this._options.clickableRows) {
      this._setupClickableRows();
    }

    EventHandler.trigger(this._element, EVENT_RENDER);
  }

  _formatCells() {
    const rows = SelectorEngine.find(SELECTOR_ROW, this._element);

    rows.forEach((row) => {
      const index = Manipulator.getDataAttribute(row, 'index');

      const cells = SelectorEngine.find(SELECTOR_CELL, row);

      cells.forEach((cell) => {
        const field = Manipulator.getDataAttribute(cell, 'field');

        const column = this.columns.find((column) => column.field === field);

        if (column && column.format !== null) {
          column.format(cell, this.rows[index][field]);
        }
      });
    });
  }

  _toggleDisableState() {
    if (this._options.pagination === false) {
      return;
    }
    if (this._activePage === 0 || this._options.loading) {
      this._paginationLeft.setAttribute('disabled', true);

      if (this._options.fullPagination) {
        this._paginationStart.setAttribute('disabled', true);
      }
    } else {
      this._paginationLeft.removeAttribute('disabled');

      if (this._options.fullPagination) {
        this._paginationStart.removeAttribute('disabled');
      }
    }

    if (this._activePage === this.pages - 1 || this._options.loading) {
      this._paginationRight.setAttribute('disabled', true);

      if (this._options.fullPagination) {
        this._paginationEnd.setAttribute('disabled', true);
      }
    } else {
      this._paginationRight.removeAttribute('disabled');

      if (this._options.fullPagination) {
        this._paginationEnd.removeAttribute('disabled');
      }
    }
  }

  _toggleSelectAll(e) {
    if (e.target.checked) {
      this._selected = this.rows.map((row) => row.rowIndex);
    } else this._selected = [];

    this._setSelected();

    this._emitSelectEvent();
  }

  _toggleSelectRow(e, rowIndex) {
    if (e.target.checked) {
      if (this._options.multi && !this._selected.includes(rowIndex)) {
        this._selected = [...this._selected, rowIndex];
      } else {
        this._selected = [rowIndex];

        this._checkboxes.forEach((checkbox) => {
          if (checkbox !== e.target) {
            checkbox.checked = false;
          }
        });
      }
    } else {
      this._selected = this._selected.filter((index) => index !== rowIndex);
    }

    this._setActiveRows();

    this._emitSelectEvent();
  }

  _updateRow(event, index) {
    const field = Manipulator.getDataAttribute(event.target, 'field');

    const value = event.target.textContent;

    const row = this._rows[index];

    if (Array.isArray(row)) {
      const column = this.columns.find((column) => {
        return column.field === field;
      });

      const columnIndex = column.columnIndex;

      row[columnIndex] = value;
    } else {
      row[field] = value;
    }

    EventHandler.trigger(this._element, EVENT_UPDATE, {
      rows: this._rows,
      columns: this._columns,
    });
  }

  static jQueryInterface(config, param1, param2) {
    return this.each(function () {
      let data = Data.getData(this, DATA_KEY);
      const _config = typeof config === 'object' && config;

      if (!data && /dispose/.test(config)) {
        return;
      }

      if (!data) {
        data = new Datatable(this, _config, param1);
      }

      if (typeof config === 'string') {
        if (typeof data[config] === 'undefined') {
          throw new TypeError(`No method named "${config}"`);
        }

        data[config](param1, param2);
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

SelectorEngine.find(SELECTOR_DATATABLE).forEach((datatable) => {
  let instance = Datatable.getInstance(datatable);
  if (!instance) {
    instance = new Datatable(datatable);
  }

  return instance;
});

/**
 * ------------------------------------------------------------------------
 * jQuery
 * ------------------------------------------------------------------------
 * add .datatable to jQuery only if jQuery is present
 */

onDOMContentLoaded(() => {
  const $ = getjQuery();

  if ($) {
    const JQUERY_NO_CONFLICT = $.fn[NAME];
    $.fn[NAME] = Datatable.jQueryInterface;
    $.fn[NAME].Constructor = Datatable;
    $.fn[NAME].noConflict = () => {
      $.fn[NAME] = JQUERY_NO_CONFLICT;
      return Datatable.jQueryInterface;
    };
  }
});

export default Datatable;
