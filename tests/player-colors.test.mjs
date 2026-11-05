import test from 'node:test';
import assert from 'node:assert/strict';
import {editionForName} from '../app.js';

test('Varo corresponde a Zafiro y Brunmega a Rubí',()=>{
 assert.equal(editionForName('Varo'),'sapphire');
 assert.equal(editionForName('Álvaro'),'sapphire');
 assert.equal(editionForName('Brunmega'),'ruby');
 assert.equal(editionForName('BrunOmega'),'ruby');
 assert.equal(editionForName('BRUN-OMEGA'),'ruby');
 assert.equal(editionForName('Jugador 1'),null);
});
