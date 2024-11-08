const { 
  issue,
  verifyCredential: vcVerify
} = require('@digitalcredentials/vc');

const { Ed25519VerificationKey2020 } = require('@digitalcredentials/ed25519-verification-key-2020');
const { Ed25519Signature2020 } = require('@digitalcredentials/ed25519-signature-2020');
const { securityLoader } = require('@digitalcredentials/security-document-loader');
const { DidKeyDriver } = require('@digitalcredentials/did-method-key');
const { CredentialIssuancePurpose } = require('@digitalcredentials/vc');

// Create a single instance of the did:key driver
const didKeyDriver = new DidKeyDriver();

// Custom document loader function
async function customDocumentLoader(url) {
  if (url.startsWith('did:key:')) {
    return await didKeyDriver.get({ url });
  }
  
  const loader = securityLoader();
  const defaultDocumentLoader = loader.build();
  return defaultDocumentLoader(url);
}

async function generateKeyPair(role) {
  try {
    // Generate key pair with did:key format
    const keyPair = await Ed25519VerificationKey2020.generate();
    
    // Convert the public key to multibase format for did:key
    const publicKeyMultibase = keyPair.publicKeyMultibase;
    const did = `did:key:${publicKeyMultibase}`;
    
    // Update the key pair with did:key information
    keyPair.controller = did;
    keyPair.id = `${did}#${publicKeyMultibase}`;
    
    console.log(`\n🔑 Generated ${role.toUpperCase()} Key Pair:`);
    console.log('------------------------');
    console.log('DID:', keyPair.controller);
    console.log('Key ID:', keyPair.id);
    console.log('Type:', keyPair.type);
    
    const exported = await keyPair.export({publicKey: true});
    console.log('Exported:', exported);
    
    return keyPair;
  } catch (error) {
    console.error(`Error generating ${role} key pair:`, error);
    throw error;
  }
}

async function issueCredential(issuerKeyPair, holderDid) {
  try {
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
        {
          "ex": "https://example.org/examples#",
          "schema": "http://schema.org/",
          "name": "schema:name",
          "description": "schema:description",
          "AchievementCredential": "ex:AchievementCredential",
          "achievementType": "ex:achievementType",
          "achievementLevel": "ex:level"
        }
      ],
      id: `urn:uuid:${Date.now()}`,
      type: ['VerifiableCredential', 'AchievementCredential'],
      issuer: {
        id: issuerKeyPair.controller
      },
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: holderDid,
        name: "Demo Achievement",
        description: "Successfully completed the SSI demo",
        achievementType: "Completion",
        achievementLevel: "Advanced"
      }
    };

    const suite = new Ed25519Signature2020({
      key: issuerKeyPair,
      verificationMethod: issuerKeyPair.id,
      date: credential.issuanceDate
    });

    const purpose = new CredentialIssuancePurpose();

    console.log('\n📜 Issuing credential...');
    console.log('Credential before issuing:', JSON.stringify(credential, null, 2));
    
    const verifiableCredential = await issue({
      credential,
      suite,
      purpose,
      documentLoader: customDocumentLoader
    });

    console.log('\nIssued credential proof:', JSON.stringify(verifiableCredential.proof, null, 2));

    return verifiableCredential;
  } catch (error) {
    console.error('Error in issueCredential:', error);
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
    }
    throw error;
  }
}

async function verifyCredential(verifiableCredential, issuerKeyPair) {
  try {
    const suite = new Ed25519Signature2020({
      key: issuerKeyPair,
      verificationMethod: verifiableCredential.proof.verificationMethod
    });

    const purpose = new CredentialIssuancePurpose();

    console.log('\n🔍 Verifying credential...');
    console.log('Using verification method:', suite.verificationMethod);

    const result = await vcVerify({
      credential: verifiableCredential,
      suite,
      purpose,
      documentLoader: customDocumentLoader
    });

    return result;
  } catch (error) {
    console.error('Error in verifyCredential:', error);
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
    }
    throw error;
  }
}

async function runDemo() {
  try {
    console.log('🚀 Starting SSI Demo with did:key...\n');

    // 1. Generate keys for all parties
    console.log('1️⃣ Generating keys for all parties...');
    const issuerKeyPair = await generateKeyPair('issuer');
    const holderKeyPair = await generateKeyPair('holder');
    const verifierKeyPair = await generateKeyPair('verifier');

    // 2. Issue credential
    console.log('\n2️⃣ Creating and issuing credential...');
    const credential = await issueCredential(issuerKeyPair, holderKeyPair.controller);
    console.log('✅ Credential issued');
    console.log('\nCredential:', JSON.stringify(credential, null, 2));

    // 3. Verify credential using issuer's key pair
    console.log('\n3️⃣ Verifying credential...');
    const result = await verifyCredential(credential, issuerKeyPair);
    
    if (result.verified) {
      console.log('\n✅ Credential successfully verified!');
      console.log('Verification result:', JSON.stringify(result, null, 2));
    } else {
      console.log('\n❌ Verification failed:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Demo error:', error);
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
    }
  }
}

runDemo();

module.exports = {
  generateKeyPair,
  issueCredential,
  verifyCredential,
  runDemo
};