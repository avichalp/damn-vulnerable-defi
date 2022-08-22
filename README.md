![](cover.png)

**This repo contains my solutions for damn vulnerable defi.**

- Damn Vulnerable DeFi is a set of challenges to hack implementations of DeFi in Ethereum. 
- It is created and maintained by [@tinchoabbate](https://twitter.com/tinchoabbate). 
- Visit [damnvulnerabledefi.xyz](damnvulnerabledefi.xyz) to try out the challenges.

## Solutions

#### Status 

- [X] Unstoppable Lender
- [ ] Naive Receiver
- [ ] Truster
- [ ] Side Entrance
- [ ] The Rewarder
- [ ] Selfie
- [ ] Compromised
- [ ] Puppet
- [ ] Puppet V2
- [ ] Free Rider
- [ ] Backdoor
- [ ] Climber
- [ ] Safe Miners

#### [Unstoppable Lender](https://github.com/avichalp/damn-vulnerable-defi/blob/master/test/unstoppable/unstoppable.challenge.js)

The attacker deploys a "receiver" contract. It has two functions: `executeFlashLoan` and `receiveTokens`. `executeFlashLoan` will trigger the flash loan from the pool. The pool will transfer the Damn Valuable tokens to the receiver and call the `receiveTokens` function, which will pay the loan back.

The lending pool's flashLoan function reverts if the pool's DVT [balance](https://github.com/tinchoabbate/damn-vulnerable-defi/blob/v2.2.0/contracts/unstoppable/UnstoppableLender.sol#L19) (stored in a public variable) is not equal to the balance before the loan is granted. 

To make the lending pool dysfunctional, the attacker can transfer some DVT tokens using ERC20 transfer instead of calling pool's `depositToken` function. 

Since depositToken is not called, the `poolBalance` variable will not be incremented with the deposit amount. Hence the assertion `poolBalance == balanceBefore` will fail when someone tries to take a flash loan.

Tests:

```sh
npm run unstoppable
```


## Disclaimer

All Solidity code, practices and patterns in this repository are DAMN VULNERABLE and for educational purposes only.

DO NOT USE IN PRODUCTION.
