export class Apiendpointd {
  public static mianUrl: string = 'http://ratco.localhost:8000/api/admins/'

  //---------------------Auth-----------------------------
  public static login: string = this.mianUrl + 'login'
  public static verify: string = this.mianUrl + 'verify'
  //---------------------Buildin--------------------------
  public static addBuildin: string = this.mianUrl + 'extended-buildings/add-building'

}

