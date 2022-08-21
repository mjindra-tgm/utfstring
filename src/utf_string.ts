/** Regular expression for matching surrogate pairs. */
const surrogatePairs = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;

/**
 * Class with UTF-safe string operations.
 */
export class UtfString {
    /** The original string that might contain UTF-32 characters. */
    private originalString: string;

    /** Regular expression matching surrogate pairs. */
    private readonly clusterRegex: RegExp;

    /**
     * Creates a new object providing UTF-safe string operations.
     * @param str The original string for which to create the UTF-safe string object.
     */
    public constructor(str: string) {
        this.originalString = str;
        this.clusterRegex = UtfString.createScanner([], "");
    }

    /**
     * Returns the character at the given index.
     * @param index The index of the wanted character.
     * @returns The character at the given index.
     */
    public charAt(index: number): string {
        const byteIndex = this.findByteIndex(index);

        if (byteIndex < 0 || byteIndex >= this.originalString.length) {
            return "";
        }

        const characters = this.originalString.slice(byteIndex, byteIndex + 8);
        const match = this.clusterRegex.exec(characters);

        return match === null ? characters[0] : match[0];
    }

    /**
     * Returns the Unicode codepoint at the given index from the string.
     * @param index The index of the wanted Unicode codepoint.
     * @returns The Unicode codepoint at the given index.
     */
    public charCodeAt(index: number): number {
        const byteIndex = this.findSurrogateByteIndex(index);

        if (byteIndex < 0) {
            return NaN;
        }

        const code = this.originalString.charCodeAt(byteIndex);

        if (0xd800 <= code && code <= 0xdbff) {
            const hi = code;
            const low = this.originalString.charCodeAt(byteIndex + 1);
            return (hi - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
        }

        return code;
    }

    public static fromCharCode(charCode: number): UtfString {
        const str = UtfString.stringFromCharCode(charCode);
        return new UtfString(str);
    }

    /**
     * Returns the string for the given Unicode codepoint.
     * @param charCode The Unicode codepoint.
     * @returns The string for the given Unicode codepoint.
     */
    public static stringFromCharCode(charCode: number): string {
        if (charCode > 0xffff) {
            charCode -= 0x10000;
            return String.fromCharCode(0xd800 + (charCode >> 10), 0xdc00 + (charCode & 0x3ff));
        } else {
            return String.fromCharCode(charCode);
        }
    }

    /**
     * Finds the first instance of the search value within the string. Starts at an optional offset.
     * @param searchValue The value to search.
     * @param start Optional start offset for the search.
     * @returns The first instance of the search value within the string.
     *          -1 if the search value could not be found.
     */
    public indexOf(searchValue: string, start = 0): number {
        const startByteIndex = this.findByteIndex(start);
        const index = this.originalString.indexOf(searchValue, startByteIndex);

        return index < 0 ? -1 : this.findCharIndex(index);
    }

    /**
     * Finds the last instance of the search value within the string.
     * Starts searching backwards at an optional offset, which can be negative.
     * @param searchValue The value to search.
     * @param start Optional start offset for the search.
     * @returns The last instance of the search value within the string.
     *          -1 if the search value could not be found.
     */
    public lastIndexOf(searchValue: string, start?: number): number {
        let index: number;

        if (typeof start === "undefined") {
            index = this.originalString.lastIndexOf(searchValue);
        } else {
            const startByteIndex = this.findByteIndex(start);
            index = this.originalString.lastIndexOf(searchValue, startByteIndex);
        }

        return index < 0 ? -1 : this.findCharIndex(index);
    }

    /**
     * Returns a new string object containing only the characters between the two given indices of the string.
     * @param start The index from which to start extracting the characters.
     * @param finish The index at which to end extracting the characters.
     * @returns A new string object containing only the characters between the two given indices.
     */
    public slice(start: number, finish?: number): UtfString {
        let startByteIndex = this.findByteIndex(start);

        if (startByteIndex < 0) {
            startByteIndex = this.originalString.length;
        }

        let finishByteIndex: number;

        if (typeof finish === "undefined") {
            finishByteIndex = this.originalString.length;
        } else {
            finishByteIndex = this.findByteIndex(finish);

            if (finishByteIndex < 0) {
                finishByteIndex = this.originalString.length;
            }
        }

        return new UtfString(this.originalString.slice(startByteIndex, finishByteIndex));
    }

    /**
     * Returns a new string object with only the characters starting at the given start index
     * up to the start index plus the given length.
     * @param start The index from which to start extracting the characters.
     * @param length The number of characters to extract.
     * @returns A new string object with only the characters starting at the given start index
     *          up to the start index plus the given length.
     */
    public substr(start: number, length?: number): UtfString {
        if (start < 0) {
            start = this.length() + start;
        }

        if (typeof length === "undefined") {
            return this.slice(start);
        } else {
            return this.slice(start, start + length);
        }
    }

    /**
     * Returns a new string object with only the characters starting at the given start index
     * up to the start index plus the given length.
     * @param start The index from which to start extracting the characters.
     * @param length The number of characters to extract.
     * @returns A new string object with only the characters starting at the given start index
     *          up to the start index plus the given length.
     */
    public substring(start: number, length?: number): UtfString {
        return this.substr(start, length);
    }

    /**
     * Returns the number of logical characters in the string.
     * @returns The number of logical characters in the string.
     */
    public length(): number {
        // findCharIndex will return -1 if string is empty, so add 1
        return this.findCharIndex(this.originalString.length - 1) + 1;
    }

    public toCodePoints(): number[] {
        const result = new Array<number>();

        for (let i = 0; i < this.originalString.length; i++) {
            const codePoint = this.charCodeAt(i);

            if (!codePoint) {
                break;
            }

            result.push(codePoint);
        }

        return result;
    }

    /**
     * Converts a string into an array of codepoints.
     * @param str The string that should be converted.
     * @returns The codepoints taken from the string.
     */
    public static stringToCodePoints(str: string): number[] {
        const utfString = new UtfString(str);
        return utfString.toCodePoints();
    }

    public static fromCodePoints(arr: number[]): UtfString {
        const str = UtfString.codePointsToString(arr);
        return new UtfString(str);
    }

    /**
     * Converts an array of codepoints into a string.
     * @param arr The codepoints that should be converted.
     * @returns The string created from the codepoints.
     */
    public static codePointsToString(arr: number[]): string {
        const chars = arr.map((a) => UtfString.stringFromCharCode(a));
        return chars.join("");
    }

    public toBytes(): number[] {
        return UtfString.stringToBytes(this.originalString);
    }

    /**
     * Converts a string into an array of UTF-16 bytes.
     * @param str The string that should be converted.
     * @returns The UTF-16 bytes created from the string.
     */
    public static stringToBytes(str: string): number[] {
        let result = new Array<number>();

        for (let i = 0; i < str.length; i++) {
            let chr = str.charCodeAt(i);
            const byteArray = new Array<number>();

            while (chr > 0) {
                byteArray.push(chr & 0xff);
                chr >>= 8;
            }

            // all utf-16 characters are two bytes
            if (byteArray.length === 1) {
                byteArray.push(0);
            }

            // assume big-endian
            result = result.concat(byteArray.reverse());
        }

        return result;
    }

    public static fromBytes(arr: number[]): UtfString {
        const str = UtfString.bytesToString(arr);
        return new UtfString(str);
    }

    /**
     * Converts an array of UTF-16 bytes into a string.
     * @param arr The array of UTF-16 bytes that should be converted.
     * @returns The string created from the array of UTF-16 bytes.
     */
    public static bytesToString(arr: number[]): string {
        const result = new Array<string>();

        for (let i = 0; i < arr.length; i += 2) {
            const hi = arr[i];
            const low = arr[i + 1];
            const combined = (hi << 8) | low;
            result.push(String.fromCharCode(combined));
        }

        return result.join("");
    }

    public toCharArray(): string[] {
        return UtfString.stringToCharArray(this.originalString);
    }

    /**
     * Converts the given string into an array of individual logical characters.
     * Note that each entry in the returned array may be more than one UTF-16 character.
     * @param str The string that should be converted.
     * @returns The array containing the individual logical characters taken from the string.
     */
    public static stringToCharArray(str: string): string[] {
        const result = new Array<string>();
        const scanner = UtfString.createScanner();

        let match: RegExpExecArray | null;
        do {
            match = scanner.exec(str);

            if (match === null) {
                break;
            }

            result.push(match[0]);
        } while (match !== null);

        return result;
    }

    /**
     * Finds the byte index for the given character index in the string.
     * Note: a "byte index" is really a "JavaScript string index", not a true byte offset.
     * Use this function to convert a UTF character boundary to a JavaScript string index.
     * @param charIndex The character index for which to find the byte index.
     * @returns The byte index for the character index in the string.
     *          -1 if the character index is equal to or higher than the length of the string.
     */
    public findByteIndex(charIndex: number): number {
        if (charIndex >= this.length()) {
            return -1;
        }

        return this.scan(UtfString.createScanner(), charIndex);
    }

    /**
     * Finds the character index for the given byte index in the string.
     * Note: a "byte index" is really a "JavaSciprt string index", not a true byte offset.
     * Use this function to convert a JavaScript string index to (the closest) UTF character boundary.
     * @param byteIndex The byte index for which to find the character index.
     * @returns The character index for the byte index in the string.
     *          -1 if the byte index is equal to or higher than the number of bytes in the string.
     */
    public findCharIndex(byteIndex: number): number {
        if (byteIndex >= this.originalString.length) {
            return -1;
        }

        // optimization: don't iterate unless necessary
        if (!this.containsGraphemeClusterGroup()) {
            return byteIndex;
        }

        const scanner = UtfString.createScanner();
        let charCount = 0;

        while (scanner.exec(this.originalString) !== null) {
            if (scanner.lastIndex > byteIndex) {
                break;
            }

            charCount++;
        }

        return charCount;
    }

    /**
     * Finds the byte index of a surrogate pair in the string up until a specific character index.
     * @param charIndex The character index up until which to search.
     * @returns The byte index of a surrogate pair in the string.
     *          -1 if no surrogate pair was found.
     */
    private findSurrogateByteIndex(charIndex: number): number {
        return this.scan(new RegExp(surrogatePairs.source, "g"), charIndex);
    }

    /**
     * Scans the string starting at a specific character index using a regular expression
     * and returns the byte index at which the scan found a match.
     * @param scanner The scanner that is used to scan the string.
     * @param charIndex The character index up until which the scan should be performed.
     * @returns The byte index at which the scan found a match.
     *          -1 if the scan did not find a match.
     */
    private scan(scanner: RegExp, charIndex: number): number {
        // optimization: don't iterate unless it's necessary
        if (!this.containsGraphemeClusterGroup()) {
            return charIndex;
        }

        let byteIndex = 0;
        let curCharIndex = 0;

        while (true) {
            const match = scanner.exec(this.originalString);
            const nextIdx = match ? match.index : this.originalString.length;

            while (curCharIndex < charIndex) {
                if (byteIndex === nextIdx) {
                    if (curCharIndex < charIndex) {
                        curCharIndex++;

                        if (match) {
                            byteIndex += match[0].length;
                        } else {
                            byteIndex++;
                        }
                    }

                    break;
                }

                byteIndex++;
                curCharIndex++;
            }

            if (curCharIndex === charIndex) {
                break;
            } else if (byteIndex >= this.originalString.length || !match) {
                return -1;
            }
        }

        return byteIndex;
    }

    /**
     * Checks if the string contains surrogate pairs.
     * @returns True if the string contains surrogate pairs or regional indicators, false otherwise.
     */
    private containsGraphemeClusterGroup(): boolean {
        return this.clusterRegex.test(this.originalString);
    }

    /**
     * Creates a regular expression for scanning strings.
     * @param extraSources Additional regular expressions that are added to the created regular expression.
     * @param modifiers Modifier flags for the created regular expression.
     * @returns The regular expression for scanning string.
     */
    private static createScanner(extraSources?: string[], modifiers?: string): RegExp {
        if (extraSources === undefined) {
            extraSources = ["[^]"];
        }

        if (modifiers === undefined) {
            modifiers = "g";
        }

        let sources = new Array<string>();

        sources.push(surrogatePairs.source);
        sources = sources.concat(extraSources);

        return new RegExp(sources.join("|"), modifiers);
    }
}
