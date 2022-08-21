export { UtfString } from "./utf_string";

// if there is a DOM add the object to the window object
if (typeof window !== "undefined" && window !== null) {
    (window as any).UtfString = UtfString;
}
