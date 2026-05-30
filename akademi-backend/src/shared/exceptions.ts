export class NotFoundException extends Error {
  statusCode = 404;

  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundException';
  }
}

