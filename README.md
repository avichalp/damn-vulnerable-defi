![](cover.png)

**This repo contains my solutions for damn vulnerable defi.**

- Damn Vulnerable DeFi is a set of challenges to hack implementations of DeFi in Ethereum. 
- It is created and maintained by [@tinchoabbate](https://twitter.com/tinchoabbate). 
- Visit [damnvulnerabledefi.xyz](https://damnvulnerabledefi.xyz) to try out the challenges.

## Solutions

#### Status 

- [X] Unstoppable Lender
- [X] Naive Receiver
- [X] Truster
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

#### [Naive Receiver](https://github.com/tinchoabbate/damn-vulnerable-defi/blob/master/test/naive-receiver/naive-receiver.challenge.js) 
The lending pool has a fee of 1 ETH for every flash loan it grants. It exposes a flash loan function that takes the amount and the borrower's address. 

The goal of this challenge is to drain the burrower's balance. It has only 10 ETH. We
(attacker) can call the flash loan function to make the pool give out a loan to the receiver contract.

When the receiver pays back, it has to pay the 1 ETH fee on top of the principal amount. Giving the receiver 10 such loans will completely drain its balance.

Tests:
```sh
npm run naive-receiver
```

#### [Truster](https://github.com/tinchoabbate/damn-vulnerable-defi/blob/0ec96d4c2f52b40ee5d16d24ff87ea5997de0d0d/test/truster/truster.challenge.js)
The truster lending pool's flashLoan function takes a target contract address and any calldata along with the burrow amount and the borrower's address. 

After granting the loan, the lending pool contract calls the target contract with the given calldata. Finally, it checks the flash loan condition. That is, if it is not true, it will revert.

The attacker can exploit the lending pool by calling the flash loan function with the target address of the DVT token. For the calldata argument, it can pass in the calldata to trigger the ERC20 "approval" for attackers to withdraw the whole pool balance.

It means at the time of granting the flash loan, the lending pool is also giving approval to the attacker to withdraw some pre-specified amount of DVT tokens (allowance) later.

After the flash loan is paid back, the attacker can simply call the ERC20  to drain all DVT tokens from the lending pool to the attacker's address.

Tests:
```sh
npm run truster
```


## Disclaimer

All Solidity code, practices and patterns in this repository are DAMN VULNERABLE and for educational purposes only.

DO NOT USE IN PRODUCTION.
