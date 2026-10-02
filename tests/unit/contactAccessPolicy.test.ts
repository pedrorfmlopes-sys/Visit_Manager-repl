import test from 'node:test';
import assert from 'node:assert/strict';
import {canReadContact,identityMatch} from '../../shared/contactAccessPolicy';

test('contact access isolates companies and revokes previous owner access', () => {
  const base = {companyId:'a',recordCompanyId:'a',userId:'u',role:'agent',active:true,createdBy:'u'};
  assert.equal(canReadContact(base),true);
  assert.equal(canReadContact({...base,createdBy:'other'}),false);
  assert.equal(canReadContact({...base,createdBy:'other',decision:'granted'}),true);
  assert.equal(canReadContact({...base,decision:'revoked'}),false);
  assert.equal(canReadContact({...base,role:'admin',recordCompanyId:'b'}),false);
  assert.equal(canReadContact({...base,role:'admin',active:false}),false);
  assert.equal(canReadContact({...base,role:'unknown'}),false);
});

test('duplicate review normalizes accents, email, PT phones and tax IDs without matching empty fields', () => {
  assert.deepEqual(identityMatch({},{}),[]);
  assert.deepEqual(identityMatch({name:'João  Lopes',email:' A@B.PT ',phone:'912 345 678',taxId:'PT501234567'},
    {name:'joao lopes',email:'a@b.pt',phone:'00351 912345678',taxId:'501234567'}),['taxId','email','phone','name']);
  assert.deepEqual(identityMatch({taxId:'123',countryCode:'PT'},{taxId:'123',countryCode:'ES'}),[]);
});
