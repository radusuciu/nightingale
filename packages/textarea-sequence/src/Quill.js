/* eslint-disable no-param-reassign */
import Quill from "quill/quill";
import "quill/dist/quill.core.css";
import debounce from "lodash-es/debounce";

const isTooShortAndFormat = (quill, seqLength, pos) => {
  if (seqLength !== null && seqLength < quill["min-sequence-length"]) {
    quill.formatText(pos - seqLength - 1, seqLength, {
      background: "rgb(255, 255, 0)",
    });
    return true;
  }
  return false;
};

const any = (list) => list.reduce((agg, v) => agg || v, false);

const paintTextareaBorder = (quill) => {
  if (quill.getText().trim() === "") {
    quill.container.style.border = "1px solid #ccc";
  } else {
    quill.container.style.border = `1px solid ${quill.valid ? "green" : "red"}`;
  }
};

let previousText = "";
const format = (quill, force = false) => {
  const text = quill.getText().trim();
  if (!force && previousText.trim() === text.trim()) return;
  previousText = text;
  quill.removeFormat(0, text.length);
  let pos = 0;
  let numberOfHeaders = 0;
  let hasInvalidCharacters = false;
  let seqLength = 0;
  let tooShort = false;
  const missingFirstHeader = !text.trim().startsWith(">");
  let secondHeaderPosition = null;
  text.split("\n").forEach((line) => {
    if (line.startsWith(">")) {
      quill.formatText(pos, line.length, "bold", true);
      if (pos !== 0 && isTooShortAndFormat(quill, seqLength, pos))
        tooShort = true;
      seqLength = 0;
      numberOfHeaders++;
      if (
        (missingFirstHeader && numberOfHeaders === 1) ||
        numberOfHeaders === 2
      ) {
        secondHeaderPosition = pos;
      }
    } else {
      seqLength += line.replace(/\s/g, "").length;
      let linePos = 0;
      const parts = line.split(
        new RegExp(`([^${quill.alphabet}])`, quill["case-sensitive"] ? "" : "i")
      );
      parts.forEach((part, i) => {
        if (i % 2 === 1) {
          quill.formatText(pos + linePos, part.length, {
            color: "rgb(255, 0, 0)",
            bold: true,
          });
          hasInvalidCharacters = true;
        }
        linePos += part.length;
      });
    }
    pos += line.length + 1; // +1 or the new line
  });
  if (isTooShortAndFormat(quill, seqLength, pos)) tooShort = true;
  const errors = {
    multipleSequences: numberOfHeaders > 1,
    hasInvalidCharacters,
    missingFirstHeader,
    tooShort,
  };
  if (quill.single && errors.multipleSequences && secondHeaderPosition) {
    quill.formatText(secondHeaderPosition, text.length - secondHeaderPosition, {
      background: "rgba(255, 0, 0, 0.5)",
    });
  }
  if (JSON.stringify(errors) !== JSON.stringify(quill.errors)) {
    quill.errors = errors;
    quill.valid = !any(Object.values(errors));
    paintTextareaBorder(quill);
    quill.container.dispatchEvent(
      new CustomEvent("change", { bubbles: true, detail: { errors } })
    );
  }
};

const cleanUpText = (quill) => {
  const sequences = [];
  let current = -1;
  const text = quill.getText();

  // Add a header if missing one
  if (!text.trim().startsWith(">")) {
    sequences.push({
      header: `Generated Header [${Math.random()}]`,
      sequence: "",
    });
    current = 0;
  }
  text.split("\n").forEach((line) => {
    if (line.startsWith(">")) {
      sequences.push({
        header: line.slice(1).trim(),
        sequence: "",
      });
      current++;
    } else {
      sequences[current].sequence += line
        .trim()
        .replace(/\s/g, "")
        .replace(
          new RegExp(
            `([^${quill.alphabet}])`,
            quill["case-sensitive"] ? "g" : "ig"
          ),
          ""
        );
    }
  });
  return (quill.single ? sequences.slice(0, 1) : sequences)
    .map(
      ({ header, sequence }) => `> ${header}\n${quill.formatSequence(sequence)}`
    )
    .join("\n\n");
  // return newText;
};
export default (
  selector,
  alphabet,
  checkCase,
  single,
  minLength,
  formatSequence
) => {
  Quill.register("modules/formatter", (quill) => {
    quill.on("text-change", debounce(()=> format(quill), 200));
  });

  const quill = new Quill(selector, {
    // debug: 'info',
    formats: ["bold", "italic", "color", "background"],
    placeholder: "Enter your sequence",
    modules: {
      formatter: true,
    },
  });

  quill.errors = {
    multipleSequences: false,
    hasInvalidCharacters: false,
    missingFirstHeader: false,
    tooShort: false,
  };
  quill.alphabet = alphabet;
  quill["case-sensitive"] = checkCase;
  quill["min-sequence-length"] = minLength;
  quill.single = single;
  quill.formatSequence = formatSequence;
  quill.format = () => format(quill, true);
  quill.cleanUp = () => {
    const newText = cleanUpText(quill);
    quill.setText(newText);
    quill.format();
  };
  return quill;
};
