import { Address, applyDoubleCborEncoding, Blockfrost, Data, fromText, getAddressDetails, Lucid, MintingPolicy, mintingPolicyToId, SpendingValidator, toHex, toUnit, Unit } from "@lucid-evolution/lucid";
import { validatorToAddress } from "@lucid-evolution/lucid";

interface BuildTransactionRequest {
  senderAddress: string;
  recipientAddress: string;
  lovelaceAmount: string;
}

const spend_val: SpendingValidator = {
  type: "PlutusV3",
  script: applyDoubleCborEncoding("59025c0101003232323232323232232225333005323232323253323300b3001300d375400426464646464646464a66602666e1d20003015375400c264646464646464646600200201444a66604000229404c94ccc074c94ccc078cdd7981218109baa00100a13371001064a66603e602a60426ea8004520001375a604a60446ea8004c94ccc07cc054c084dd50008a6103d87a8000132330010013756604c60466ea8008894ccc094004530103d87a80001323232325333025337220180042a66604a66e3c0300084cdd2a4000660546ea00052f5c02980103d87a8000133006006003375a604e0066eb8c094008c0a4008c09c004c8cc004004dd59812981318111baa00222533302400114c103d87a80001323232325333024337220180042a66604866e3c0300084cdd2a4000660526e980052f5c02980103d87a80001330060060033756604c0066eb8c090008c0a0008c09800452818118010a511330030030013023001375c603e60400046eb8c078004c078008dd6980e000980e001180d000980b1baa30193016375400c2a6602892014865787065637420536f6d6528446174756d207b2073656c6c65722c207061796d656e74416d6f756e742c20617373657449642c2061737365744e616d65207d29203d20646174756d001637566030603260320046eb0c05c004c05cc05c008dd6180a80098089baa008301330140023012001300e37540046e1d200216300f3010002300e001300e002300c001300837540022930a9980324811856616c696461746f722072657475726e65642066616c73650013656375c002ae695ce2ab9d5573caae7d5d02ba157441"), // CBOR format from plutus.json
};
 
const mintingPolicy: MintingPolicy = {
  type: "PlutusV3",
  script: applyDoubleCborEncoding("58a0010100323232323232323225333003323232323253330083370e900018051baa001132533333300f00300800800813371090051bad003008375c601860166ea800458c02cc030008c028004c028008c020004c018dd50008a4c2a6600892011856616c696461746f722072657475726e65642066616c73650013656153300249010d72656465656d65723a20496e7400165734ae7155ceaab9e5742ae895d201"), // CBOR format from plutus.json
};

export const CredentialSchema = Data.Enum([
  Data.Object({
      PublicKeyCredential: Data.Tuple([
          Data.Bytes(),
      ]),
  }),
  Data.Object({
      ScriptCredential: Data.Tuple([
          Data.Bytes(),
      ]),
  }),
]);
export type CredentialD = Data.Static<typeof CredentialSchema>;
export const CredentialD = CredentialSchema as unknown as CredentialD;

// pub type Datum {
//   seller: Address,
//   paymentAmount: Int,
//   assetId: PolicyId,
//   assetName: AssetName,
// }
export const AddressSchema = Data.Object({
  paymentCredential: CredentialSchema,
  stakeCredential: Data.Nullable(
      Data.Enum([
          Data.Object({ Inline: Data.Tuple([CredentialSchema]) }),
          Data.Object({
              Pointer: Data.Tuple([
                  Data.Object({
                      slotNumber: Data.Integer(),
                      transactionIndex: Data.Integer(),
                      certificateIndex: Data.Integer(),
                  }),
              ]),
          }),
      ]),
  ),
});

export type AddressD = Data.Static<typeof AddressSchema>;
export const AddressD = AddressSchema as unknown as AddressD;

export function fromAddress(address: Address): AddressD {
  // We do not support pointer addresses!

  const { paymentCredential, stakeCredential } = getAddressDetails(address);

  if (!paymentCredential) throw new Error("Not a valid payment address.");

  return {
    paymentCredential: paymentCredential?.type === "Key"
      ? {
        PublicKeyCredential: [paymentCredential.hash],
      }
      : { ScriptCredential: [paymentCredential.hash] },
    stakeCredential: stakeCredential
      ? {
        Inline: [
          stakeCredential.type === "Key"
            ? {
              PublicKeyCredential: [stakeCredential.hash],
            }
            : { ScriptCredential: [stakeCredential.hash] },
        ],
      }
      : null,
  };
}

const DatumSchema = Data.Object({
  seller: AddressSchema,
  assetAmount: Data.Integer(),
  assetId: Data.Bytes(),
  assetName: Data.Bytes(),
});
type DatumType = Data.Static<typeof DatumSchema>;
const DatumType = DatumSchema as unknown as DatumType;

const ourTokenCurrencySymbol = mintingPolicyToId(mintingPolicy);
const ourToken : Unit = toUnit(ourTokenCurrencySymbol, fromText("hello3"));
const referenceUTxoToken = toUnit(ourTokenCurrencySymbol, fromText("hello2"));
export async function buildTransaction(req: BuildTransactionRequest) {
  try {
    // Initialize Lucid with Blockfrost
    const lucid = await Lucid(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        process.env.REACT_APP_BLOCKFROST_API_KEY,
      ),
      "Preview",
    );

    // get the address of a script
    const scriptAddress = validatorToAddress("Preview", spend_val);

    // get the utxos at a script address
    //const referenceUTxO = await lucid.utxosAt(validatorToAddress("Preview", mintingPolicy))

    // get the UTxO containing an NFT 
    //const referenceUtxo = await lucid.utxoByUnit(referenceUTxoToken)

    // Select the sender's wallet
    lucid.selectWallet.fromAddress(req.senderAddress, []);
    
    // get the address of the wallet that currently connected. 
    const ownAddress = await lucid.wallet().address()
    
    const ourDatum : DatumType = 
     {
        seller: fromAddress(ownAddress),
        assetAmount: BigInt(1),
        assetId: ourTokenCurrencySymbol,
        assetName: fromText("hello3"),
      }

    // Build a transaction to lock 10 ada at the script with the datum above
    // const tx = await lucid
    //   .newTx()
    //   .pay.ToAddressWithData(scriptAddress, {kind: "inline", value: Data.to<DatumType>(ourDatum)}, { lovelace: BigInt(10_000_000) })
    //   .complete();
    
    // const [scriptUTxO, scriptUTxO2] = await lucid.utxosAt(scriptAddress);
    // const unlockTx = await lucid
    //   .newTx()
    //   .collectFrom([scriptUTxO], Data.void())
    //   .collectFrom([scriptUTxO2], Data.void())
    //   .pay.ToAddress(ownAddress, { [ourToken]: BigInt(0) })
    //   .pay.ToAddress(ownAddress, { [ourToken]: BigInt(1) })
    //   .attach.SpendingValidator(spend_val)
    //   .complete();
    
    // Build a transaction to mint a token 
    const tx = await lucid
      .newTx()
      .mintAssets({[ourToken]: BigInt(1)}, Data.to(BigInt(6)))
      .attach.MintingPolicy(mintingPolicy)
      .complete();

    // Build the transaction to mint a token to an output containing a reference script:
    // const tx = await lucid
    //   .newTx()
    //   .pay.ToAddressWithData(validatorToAddress("Preview", mintingPolicy), undefined, {
    //     [ourToken]: BigInt(1)
    //   }, mintingPolicy)
    //   .mintAssets({[ourToken]: BigInt(1)}, Data.to(BigInt(6)))
    //   .attach.MintingPolicy(mintingPolicy)
    //   .complete();
    
    // Build the transaction to mint a token and using a refernce input with the script instead of attaching the script directly
    // const tx = await lucid
    //   .newTx()
    //   .readFrom([referenceUtxo])
    //   .mintAssets({[ourToken]: BigInt(1)}, Data.to(BigInt(6)))
    //   .complete();

    // Return the transaction CBOR
    return { tx: tx.toCBOR() };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to build transaction",
    );
  }
}
