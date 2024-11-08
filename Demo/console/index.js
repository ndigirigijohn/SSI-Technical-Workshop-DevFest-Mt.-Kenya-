const { 
  issue,
  verifyCredential: vcVerify
} = require('@digitalcredentials/vc');

const { Ed25519VerificationKey2020 } = require('@digitalcredentials/ed25519-verification-key-2020');
const { Ed25519Signature2020 } = require('@digitalcredentials/ed25519-signature-2020');
const { securityLoader } = require('@digitalcredentials/security-document-loader');
const { DidKeyDriver } = require('@digitalcredentials/did-method-key');
const { CredentialIssuancePurpose } = require('@digitalcredentials/vc');


const PARTICIPANT = "Alice Doe";

const didKeyDriver = new DidKeyDriver();

async function customDocumentLoader(url) {
  if (url.startsWith('did:key:')) {
    const result = await didKeyDriver.get({ url });
    return result;
  }
  
  const loader = securityLoader();
  const defaultDocumentLoader = loader.build();
  return defaultDocumentLoader(url);
}

async function generateKeyPair(role) {
  try {
    const keyPair = await Ed25519VerificationKey2020.generate();
    const publicKeyMultibase = keyPair.publicKeyMultibase;
    const did = `did:key:${publicKeyMultibase}`;
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
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.1.json',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: [
        'VerifiableCredential',
        'OpenBadgeCredential'
      ],
      name: 'DevFest Mt Kenya SSI Workshop Attendance',
      issuer: {
        type: ['Profile'],
        id: issuerKeyPair.controller,
        name: 'DevFest Mt Kenya',
        url: 'https://gdg.community.dev/gdg-mt-kenya/',
        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrJ20Y03jPHKxgQ2HXQ36tGm9u62u4pedvpA&s'
      },
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: holderDid,
        type: ['AchievementSubject'],
        achievement: {
          id: `urn:uuid:${crypto.randomUUID()}`,
          type: ['Achievement'],
          achievementType: 'Workshop Attendance',
          name: 'SSI Technical Deep Dive Workshop',
          description: 'Successfully completed the Self-Sovereign Identity (SSI) Technical Deep Dive Workshop at DevFest Mt Kenya 2024. This workshop covered DIDs, Verifiable Credentials, and hands-on implementation of SSI solutions.',
          criteria: {
            type: 'Criteria',
            narrative: 'This credential was issued to an attendee who:\n' +
              '1. Participated in the full-day SSI Technical Workshop\n' +
              '2. Completed hands-on exercises with DIDs and VCs\n' +
              '3. Demonstrated understanding of SSI concepts through practical implementation'
          },
          image: {
            id: 'https://placeholder.com/workshop-badge.png', 
            type: 'Image'
          }
        },
        name: PARTICIPANT
      },
      expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2).toISOString(), // 2 years from now
    };

    const suite = new Ed25519Signature2020({
      key: issuerKeyPair,
      date: credential.issuanceDate
    });

    const purpose = new CredentialIssuancePurpose({
      controller: {
        id: issuerKeyPair.controller,
        assertionMethod: [issuerKeyPair.id]
      },
      date: credential.issuanceDate
    });

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
    console.log('\n🔍 Verifying credential...');
    console.log('Verification Method:', verifiableCredential.proof.verificationMethod);

    const verificationKey = await Ed25519VerificationKey2020.from({
      ...issuerKeyPair,
      id: verifiableCredential.proof.verificationMethod,
      controller: verifiableCredential.issuer.id
    });

    const suite = new Ed25519Signature2020({
      key: verificationKey
    });

    const purpose = new CredentialIssuancePurpose({
      controller: {
        id: issuerKeyPair.controller,
        assertionMethod: [issuerKeyPair.id]
      },
      date: verifiableCredential.issuanceDate
    });

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
    console.log('🚀 Starting DevFest Mt Kenya SSI Workshop Demo...\n');

    console.log('1️⃣ Generating keys for issuer and participant...');
    const issuerKeyPair = await generateKeyPair('issuer');
    const participantKeyPair = await generateKeyPair('participant');

    console.log('\n2️⃣ Creating and issuing workshop attendance credential...');
    const credential = await issueCredential(issuerKeyPair, participantKeyPair.controller);
    console.log('✅ Credential issued');
    console.log('\nCredential:', JSON.stringify(credential, null, 2));

    console.log('\n3️⃣ Verifying credential...');
    const result = await verifyCredential(credential, issuerKeyPair);
    
    if (result.verified) {
      console.log('\n✅ Credential successfully verified!');
      console.log('Verification result:', JSON.stringify(result, null, 2));
      
      console.log('\n🎉 Congratulations! 🎉');
      console.log('==================================');
      console.log('🌟 You have successfully:');
      console.log('   ✅ Generated DIDs');
      console.log('   ✅ Created a Verifiable Credential');
      console.log('   ✅ Issued the Credential');
      console.log('   ✅ Verified the Credential');
      console.log('\n🎓 You\'ve completed the SSI Technical Demo!');
      console.log('💡 You now understand the basics of:');
      console.log('   • DIDs (Decentralized Identifiers)');
      console.log('   • VCs (Verifiable Credentials)');
      console.log('   • Credential Issuance & Verification');
      console.log('\n🚀 Keep building the decentralized future!');
      console.log('==================================');
    } else {
      console.log('\n❌ Verification failed');
      console.log('Verification result:', JSON.stringify(result, null, 2));
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