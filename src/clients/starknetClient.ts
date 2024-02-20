import { BigNumberish, BlockIdentifier, BlockTag, num } from 'starknet';


export default class StarknetClient {

    public static async getClassHashesAt (
        contractAddresses: BigNumberish[],
        nodeUrl: string,
        blockIdentifier: BlockIdentifier = BlockTag.latest,
    ): Promise<string[]> {
        const contract_addresses = contractAddresses.map(address => num.toHex(address));
        const block_id = new Block(blockIdentifier).identifier;

        const batchRequests = contract_addresses.map((contract_address, index) => ({
            id: index,
            jsonrpc: '2.0',
            method: 'starknet_getClassHashAt',
            params: {
                contract_address,
                block_id,
            },
        }));

        return fetch(nodeUrl, {
            method: 'POST',
            body: JSON.stringify(batchRequests),
            headers: { 'Content-Type': 'application/json' },
        })
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    return data.map(item => item.result ? item.result : null);
                } else {
                    throw Error('Unexpected response format');
                }
            })
            .catch(error => {
                console.error('Error fetching class hashes:', error);
                throw error;
            });
    };
}

class Block {
    hash: BlockIdentifier = null;

    number: BlockIdentifier = null;

    tag: BlockIdentifier = null;

    private setIdentifier (__identifier: BlockIdentifier) {
        if (typeof __identifier === 'string' && num.isHex(__identifier)) {
            this.hash = __identifier;
        } else if (typeof __identifier === 'bigint') {
            this.hash = num.toHex(__identifier);
        } else if (typeof __identifier === 'number') {
            this.number = __identifier;
        } else if (
            typeof __identifier === 'string' &&
            Object.values(BlockTag).includes(__identifier as BlockTag)
        ) {
            this.tag = __identifier;
        } else {
            this.tag = BlockTag.pending;
        }
    };

    constructor (_identifier: BlockIdentifier) {
        this.setIdentifier(_identifier);
    };

    get identifier (): any {
        if (this.number !== null) {
            return { block_number: this.number };
        }

        if (this.hash !== null) {
            return { block_hash: this.hash };
        }

        return this.tag;
    };

    valueOf = () => this.number;

    toString = () => this.hash;
}