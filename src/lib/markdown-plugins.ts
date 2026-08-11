import { defaultSchema } from 'rehype-sanitize'
import { defaultRehypePlugins, type StreamdownProps } from 'streamdown'

/**
 * Streamdown's rehype pipeline, with math repaired.
 *
 * Streamdown typesets `$$…$$` with KaTeX and then sanitises the result with
 * GitHub's allowlist, which permits `className` on `code` and nothing else.
 * KaTeX's HTML output is entirely class-driven, so every hook its stylesheet
 * needs is stripped, and the elements the stylesheet exists to hide — the
 * MathML copy and the LaTeX source in `<annotation>` — render as text next to
 * the visual one. `$$E = mc^2$$` came out as "E=mc2E = mc^2E=mc2".
 *
 * The repair is to typeset to MathML instead and allow those elements through:
 * browsers lay MathML out natively, so nothing depends on classes surviving.
 * Allowing class names on `span` would have fixed the HTML path too, but this
 * renders model output — a reply could then style itself into a full-page
 * overlay out of the app's own utility classes. MathML elements carry no such
 * power, which is what makes this the narrow fix.
 */

// Every element KaTeX emits with `output: 'mathml'`. Presentation MathML only —
// no <maction>, which can carry behaviour.
const MATHML_TAGS = [
  'annotation',
  'math',
  'menclose',
  'merror',
  'mfrac',
  'mi',
  'mmultiscripts',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mprescripts',
  'mroot',
  'mrow',
  'ms',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msubsup',
  'msup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
  'semantics',
]

// Layout attributes MathML reads. `class`/`style` are deliberately absent.
//
// Everything KaTeX emits has to be here or the sanitiser drops it: `mtable`
// carries the column spacing for matrices and aligned equations, and `menclose`
// carries the box `\boxed` draws. Enumerated by rendering a spread of TeX
// through KaTeX and diffing the attributes against this list, rather than
// guessed.
const MATHML_ATTRIBUTES = [
  'accent',
  'accentunder',
  'columnalign',
  'columnspacing',
  'notation',
  'xmlns',
  'depth',
  'display',
  'displaystyle',
  'encoding',
  'fence',
  'height',
  'largeop',
  'linethickness',
  'lspace',
  'mathvariant',
  'maxsize',
  'minsize',
  'movablelimits',
  'rowalign',
  'rowspacing',
  'rspace',
  'scriptlevel',
  'separator',
  'stretchy',
  'symmetric',
  'voffset',
  'width',
]

const mathSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...MATHML_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    ...Object.fromEntries(MATHML_TAGS.map((tag) => [tag, MATHML_ATTRIBUTES])),
  },
}

type RehypePlugins = NonNullable<StreamdownProps['rehypePlugins']>
type PluginTuple = Extract<RehypePlugins[number], readonly [unknown, ...unknown[]]>

/** The plugin behind one of Streamdown's defaults, reused with our own options. */
function pluginOf(entry: (typeof defaultRehypePlugins)[string]): PluginTuple[0] {
  return (Array.isArray(entry) ? entry[0] : entry) as PluginTuple[0]
}

// Same plugins in the same order as Streamdown's own list — only the KaTeX
// output format and the sanitiser's allowlist differ. Passing `rehypePlugins`
// replaces the list wholesale, so anything dropped here stops running.
export const rehypePlugins: RehypePlugins = [
  pluginOf(defaultRehypePlugins.raw),
  [pluginOf(defaultRehypePlugins.katex), { errorColor: 'var(--color-muted-foreground)', output: 'mathml' }],
  [pluginOf(defaultRehypePlugins.sanitize), mathSchema],
  defaultRehypePlugins.harden,
]
