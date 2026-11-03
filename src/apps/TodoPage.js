import { TODO_PAGE } from '../utils/paint.js';

let counter = 0;
export const todoId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

const MAX_LENGTH = 32;

/**
 * Editable to-do list laid out on the notebook's ruled lines (512×700 page px).
 * Mutates `items` in place and calls `onChange()` after every edit.
 */
export class TodoPage {
  constructor({ title, items, onChange }) {
    this.items = items;
    this.onChange = onChange;

    const el = document.createElement('div');
    el.className = 'todo';
    const heading = document.createElement('div');
    heading.className = 'todo__title';
    heading.textContent = title;
    this.list = document.createElement('ol');
    this.list.className = 'todo__list';
    el.append(heading, this.list);
    this.element = el;

    el.addEventListener('click', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      const i = Number(row.dataset.i);
      if (e.target.closest('.todo__check')) {
        this.items[i].done = !this.items[i].done;
        this.commit(i, '.todo__check');
      } else if (e.target.closest('.todo__del')) {
        this.items.splice(i, 1);
        this.commit(Math.min(i, this.items.length));
      }
    });

    el.addEventListener('input', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      this.items[Number(row.dataset.i)].text = e.target.value;
      this.onChange();
    });

    el.addEventListener('keydown', (e) => {
      const input = e.target.closest('.todo__input');
      if (!input) return;
      const row = input.closest('li');
      const adding = row.classList.contains('todo__row--add');
      const i = adding ? this.items.length : Number(row.dataset.i);

      if (e.key === 'Enter') {
        e.preventDefault();
        if (adding) {
          const text = input.value.trim();
          if (!text) return;
          this.items.push({ id: todoId(), text, done: false });
          this.commit(this.items.length);
        } else {
          this.focusRow(i + 1);
        }
      } else if (e.key === 'Backspace' && !adding && input.value === '') {
        e.preventDefault();
        this.items.splice(i, 1);
        this.commit(Math.max(0, i - 1));
      } else if (e.key === 'ArrowDown') {
        this.focusRow(i + 1);
      } else if (e.key === 'ArrowUp') {
        this.focusRow(i - 1);
      }
    });

    this.render();
  }

  render() {
    const rows = this.items.slice(0, TODO_PAGE.maxItems).map((item, i) => {
      const li = document.createElement('li');
      li.className = `todo__row${item.done ? ' is-done' : ''}`;
      li.dataset.i = i;
      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo__check';
      check.setAttribute('aria-label', item.done ? 'Mark as not done' : 'Mark as done');
      const input = document.createElement('input');
      input.className = 'todo__input';
      input.value = item.text;
      input.maxLength = MAX_LENGTH;
      input.setAttribute('aria-label', 'Task');
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'todo__del';
      del.setAttribute('aria-label', 'Delete task');
      del.textContent = '×';
      li.append(check, input, del);
      return li;
    });

    if (this.items.length < TODO_PAGE.maxItems) {
      const li = document.createElement('li');
      li.className = 'todo__row todo__row--add';
      const plus = document.createElement('span');
      plus.className = 'todo__plus';
      plus.textContent = '+';
      plus.setAttribute('aria-hidden', 'true');
      const input = document.createElement('input');
      input.className = 'todo__input';
      input.placeholder = 'add a task';
      input.maxLength = MAX_LENGTH;
      input.setAttribute('aria-label', 'Add a task');
      li.append(plus, input);
      rows.push(li);
    }
    this.list.replaceChildren(...rows);
  }

  commit(focusIndex, selector = '.todo__input') {
    this.render();
    this.onChange();
    this.focusRow(focusIndex, selector);
  }

  focusRow(i, selector = '.todo__input') {
    const row = this.list.children[Math.max(0, i)];
    row?.querySelector(selector)?.focus({ preventScroll: true });
  }

  /** Put the caret in the "add a task" line. */
  focusAdd() {
    this.list.querySelector('.todo__row--add .todo__input')?.focus({ preventScroll: true });
  }
}
