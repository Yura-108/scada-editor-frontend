const fs = require('fs');
let code = fs.readFileSync('backups/Canvas.tsx.bak', 'utf-8');
// replace Rnd import
code = code.replace('import {Rnd} from "react-rnd";', 'import interact from "interactjs";');
console.log("Ready to edit Canvas.tsx");
