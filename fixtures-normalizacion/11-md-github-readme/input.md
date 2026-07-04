<h1 align="center">
	<br>
	<br>
	<img width="320" src="media/logo.svg" alt="Chalk">
	<br>
	<br>
	<br>
</h1>

> Terminal string styling done right

[![Coverage Status](https://codecov.io/gh/chalk/chalk/branch/main/graph/badge.svg)](https://codecov.io/gh/chalk/chalk)
[![npm dependents](https://badgen.net/npm/dependents/chalk)](https://www.npmjs.com/package/chalk?activeTab=dependents)
[![Downloads](https://badgen.net/npm/dt/chalk)](https://www.npmjs.com/package/chalk)

![](media/screenshot.png)

## Info

- [Why not switch to a smaller coloring package?](https://github.com/chalk/chalk?tab=readme-ov-file#why-not-switch-to-a-smaller-coloring-package)
- See [yoctocolors](https://github.com/sindresorhus/yoctocolors) for a smaller alternative

## Highlights

- Expressive API
- Highly performant
- No dependencies
- Ability to nest styles
- [256/Truecolor color support](#256-and-truecolor-color-support)
- Auto-detects color support
- Doesn't extend `String.prototype`
- Clean and focused
- Actively maintained
- [Used by ~115,000 packages](https://www.npmjs.com/browse/depended/chalk) as of July 4, 2024

## Install

```sh
npm install chalk
```

**IMPORTANT:** Chalk 5 is ESM. If you want to use Chalk with TypeScript or a build tool, you will probably want to use Chalk 4 for now. [Read more.](https://github.com/chalk/chalk/releases/tag/v5.0.0)

## Usage

```js
import chalk from 'chalk';

console.log(chalk.blue('Hello world!'));
```

Chalk comes with an easy to use composable API where you just chain and nest the styles you want.

```js
import chalk from 'chalk';

const log = console.log;

// Combine styled and normal strings
log(chalk.blue('Hello') + ' World' + chalk.red('!'));

// Compose multiple styles using the chainable API
log(chalk.blue.bgRed.bold('Hello world!'));

// Pass in multiple arguments
log(chalk.blue('Hello', 'World!', 'Foo', 'bar', 'biz', 'baz'));

// Nest styles
log(chalk.red('Hello', chalk.underline.bgBlue('world') + '!'));
```

## API

### chalk.`<style>[.<style>...](string, [string...])`

Example: `chalk.red.bold.underline('Hello', 'world');`

Chain [styles](#styles) and call the last one as a method with a string argument. Order doesn't matter, and later styles take precedent in case of a conflict.

### chalk.level

Specifies the level of color support.

| Level | Description |
| :---: | :--- |
| `0` | All colors disabled |
| `1` | Basic color support (16 colors) |
| `2` | 256 color support |
| `3` | Truecolor support (16 million colors) |

### supportsColor

Detect whether the terminal [supports color](https://github.com/chalk/supports-color). Used internally and handled for you, but exposed for convenience.

## Styles

### Modifiers

- `reset` - Reset the current style.
- `bold` - Make the text bold.
- `dim` - Make the text have lower opacity.
- `italic` - Make the text italic. *(Not widely supported)*
- `underline` - Put a horizontal line below the text. *(Not widely supported)*
- `strikethrough` - Puts a horizontal line through the center of the text.

### Colors

- `black`
- `red`
- `green`
- `yellow`
- `blue`
- `magenta`
- `cyan`
- `white`

## Browser support

Since Chrome 69, ANSI escape codes are natively supported in the developer console.

## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [Josh Junon](https://github.com/qix-)
