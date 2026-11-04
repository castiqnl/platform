/** Explicit local/test sandbox. This adapter never contacts a social provider. */
export class SandboxAdapter {
 readonly mode='demo';
 async prepare(job:any){if(job.providerMode!=='demo'||job.adapter!=='explicit-sandbox')throw new Error('Alleen expliciete sandboxopdrachten zijn toegestaan.');if(!job.requestId||!job.payload||!job.contentHash)throw new Error('De bevroren sandboxaanvraag is onvolledig.');return {requestId:job.requestId,payload:structuredClone(job.payload)};}
 async publish(prepared:{requestId:string;payload:any}){return {requestId:prepared.requestId,status:'awaiting_confirmation' as const,notice:'Sandboxaanvraag aangeboden; uitsluitend een expliciete sandboxbevestiging kan de demo afronden.'};}
 async readStatus(requestId:string){return {requestId,status:'awaiting_confirmation' as const};}
 async reconcile(requestId:string){return this.readStatus(requestId);}
 async handleReceipt(){throw new Error('Een sandboxreceipt wordt uitsluitend door de expliciete geauthenticeerde sandboxactie vastgelegd.');}
}
