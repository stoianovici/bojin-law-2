declare module 'density-clustering' {
  export class OPTICS {
    constructor();
    run(dataset: number[][], epsilon: number, minPts: number): number[][];
  }

  export class DBSCAN {
    constructor();
    run(dataset: number[][], epsilon: number, minPts: number): number[][];
  }

  export class KMEANS {
    constructor();
    run(dataset: number[][], k: number): number[][];
  }
}
