export interface MonteCarloParams {
    entry_price: number;
    average_return: number;
    volatility: number;
    days: number;
    paths: number; 
}

export function runMonteCarloCPU(params: MonteCarloParams){
    const {entry_price, average_return, volatility, days, paths} = params;

    const dt = 1/252;
    const results: number[][] = [];

    const startTime = performance.now();

    for (let i = 0; i < paths; i++){
        const path: number[] = [];
        let price = entry_price

        for (let t = 0; t < days; t++){
            const z = randomNormal();
            price = price * Math.exp(
                (average_return - 0.5 * volatility * volatility) * dt + volatility * Math.sqrt(dt) * z);
        path.push(price);
        }
    results.push(path);
    }
    const endTime = performance.now();

    return{
        paths:results,
        time: endTime - startTime
    }
}
function randomNormal(){
    const n1 = Math.random();
    const n2 = Math.random();

    return Math.sqrt(-2.0 * Math.log(n1)) *
            Math.cos(2.0 * Math.PI * n2);
}