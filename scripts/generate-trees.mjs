import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();await page.goto('http://127.0.0.1:5173');
const geometries=await page.evaluate(async()=>{const {Tree}=await import('/node_modules/@dgreenheck/ez-tree/build/ez-tree.es.js');return [0,1,2].map(i=>{const tree=new Tree();tree.options.seed=42+i;tree.options.branch.levels=1;tree.options.branch.length[0]=12;tree.options.branch.length[1]=3;tree.options.branch.radius[0]=.65;tree.options.branch.children[0]=4;tree.options.branch.sections[0]=5;tree.options.branch.segments[0]=5;tree.options.bark.textured=false;tree.generate();return tree.children.find(c=>c.isMesh).geometry.toJSON();});});
await writeFile('src/world/tree-branches.json',JSON.stringify(geometries));await browser.close();console.log('Generated three reusable EZ-Tree branch variants.');
