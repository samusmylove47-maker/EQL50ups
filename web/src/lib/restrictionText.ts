/**
 * A `cl` or `ra` list as a reader should see it in a field.
 *
 * The prose version of this lives in `blockReason.ts`, which writes a whole
 * sentence about why a gate closed. This one is for the places that print the
 * restriction *as a value* — `ItemWindow`'s Requirements block and the item
 * browser's Class column — where the answer has to fit in a table cell.
 *
 * Both surfaces printed the list raw. `["ALL_EXCEPT","ENC","MAG","WIZ"]` came
 * out as `ALL_EXCEPT ENC MAG WIZ` (and, in the item window's wide mode, as
 * `ALL_EXCEPT Enchanter Magician Wizard` — the sentinel surviving the
 * code-to-name map because it is not a class code and fell through the `?? c`).
 * That names a class that does not exist and inverts the rule. 255 records
 * carry it in `cl`, 59 in `ra`.
 *
 * The reading comes from `readRestriction`, which is the same call the
 * eligibility gate makes, so the field and the red name beside it cannot
 * disagree about what the list says.
 */

import { readRestriction } from '../engine/character';

/**
 * `ALL`, `NONE`, `ALL except X Y`, or the plain list — with `label` applied to
 * each code so a caller can print codes or full names.
 *
 * **Where this collapses a list, it is inert on what ships.** A list holding
 * `ALL` *and* other codes would now print just `ALL`, and one holding `NONE`
 * and others just `NONE`, because that is what the gate reads them as. Neither
 * shape occurs: counted over the shipped 3,663 records, `ALL` mixed with other
 * codes is 0 in both `cl` and `ra`, and `NONE` mixed is 0 in both.
 */
export function restrictionText(
  list: readonly string[],
  label: (code: string) => string = (c) => c,
  separator = ' ',
): string {
  const reading = readRestriction(list);
  switch (reading.kind) {
    case 'unrestricted':
      return 'ALL';
    case 'none':
      return 'NONE';
    case 'except':
      // An `ALL_EXCEPT` with nothing after it excludes nobody, which is what
      // `matchesList` already concludes. 0 records ship in that shape.
      return reading.codes.length
        ? `ALL except ${reading.codes.map(label).join(separator)}`
        : 'ALL';
    case 'only':
      return reading.codes.map(label).join(separator);
  }
}
