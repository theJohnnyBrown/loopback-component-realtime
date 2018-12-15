declare var require: any;
import { DriverInterface } from '../types/driver';
import { OptionsInterface } from '../types/options';
import { RealTimeLog } from '../logger';
import * as server from 'socket.io';
import * as client from 'socket.io-client';
import * as _ from 'underscore';

export class IODriver implements DriverInterface {

  client: any;
  server: any;
  internal: any;
  options: OptionsInterface;
  connections: Array<any> = new Array();
  private customAuthListener: Function;
  /**
   * @method connect
   * @param {OptionsInterface} options
   * @description Will create a web socket server and then setup either clustering
   * and authentication functionalities.
   **/
  connect(options?: OptionsInterface): any {
    this.options = options;
    this.server = server(options.server, { transports: options.driver.options.transports });
    this.onConnection((socket: any) => this.newConnection(socket));
    this.setupClustering();
    this.setupAuthResolver();
    this.setupAuthentication();
    this.setupClient();
    this.setupInternal();
    this.options.app.emit('fire-connection-started');
  }
  setupAuthResolver(): void {
    if (this.options.auth) {
      RealTimeLog.log('RTC requesting custom resolvers');
      this.options.app.on('fire-auth-resolver', (authResolver: any) => {
        if (!authResolver || !authResolver.name || !authResolver.handler) {
          throw new Error('FireLoop: Custom auth resolver does not provide either name or handler');
        }
        this.server.on('connection', (socket: any) => {
          socket.on(authResolver.name, (payload: any) =>
            authResolver.handler(socket, payload, (token: any) => {
              if (token) {
                this.restoreNameSpaces(socket);
                socket.token = token;
                socket.emit('authenticated');
              }
            }
          ))
        });
      });
    }
  }
  /**
   * @method setupClustering
   * @description Will setup socket.io adapters. This module is adapter agnostic, it means
   * it can use any valid socket.io-adapter, can either be redis or mongo. It will be setup
   * according the provided options. 8990021
   **/
  setupClustering(): void {
    if (
      this.options.driver.options.adapter &&
      this.options.driver.options.adapter.name &&
      this.options.driver.options.adapter.datasource &&
      this.options.app.datasources[this.options.driver.options.adapter.datasource] &&
      this.options.app.datasources[this.options.driver.options.adapter.datasource].settings
    ) {
      let adapter: any = require(this.options.driver.options.adapter.name);
      let ds: any = this.options.app.datasources[this.options.driver.options.adapter.datasource]
      if (ds.settings.url) {
        RealTimeLog.log('Running in clustering environment');
        this.server.adapter(adapter(ds.settings.url));
      } else if (ds.settings.host && ds.settings.port && ds.settings.db) {
        let adapterOptions: {
          host: string,
          port: number,
          db: string,
          user?: string,
          password?: string
        } = {
            host: ds.settings.host,
            port: ds.settings.port,
            db: ds.settings.db
          };
        if (ds.settings.user)
          adapterOptions.user = ds.settings.user;

        if (ds.settings.password)
          adapterOptions.password = ds.settings.password;
        RealTimeLog.log('Running in clustering environment');
        this.server.adapter(adapter(adapterOptions));
      } else {
        throw new Error('loopback-realtime-component: Unexpected datasource options for clustering mode.');
      }
    } else {
      RealTimeLog.log('Running in a not clustered environment');
    }
  }
  /**
   * @method setupAuthentication
   * @description Will setup an authentication mechanism, for this we are using socketio-auth
   * connected with LoopBack Access Token.
   **/
  setupAuthentication(): void {
    if (this.options.auth) {
      RealTimeLog.log('RTC authentication mechanism enabled');
      // Remove Unauthenticated sockets from namespaces
      _.each(this.server.nsps, (nsp: any) => {
        nsp.on('connect', (socket: any) => {
          if (!socket.token) {
            delete nsp.connected[socket.id];
          }
        });
      });
      this.server.on('connection', (socket: any) => {
        /**
         * Register Built in Auth Resolver
         */
        socket.on('authentication', (token: any) => {
          var initialToken = (<any>Object).assign({}, token);
          delete initialToken.user;
          if (!token) {
            return;
          }
          if (token.is === '-*!#fl1nter#!*-') {
            RealTimeLog.log('Internal connection has been established');
            this.restoreNameSpaces(socket);
            socket.token = token;
            return socket.emit('authenticated');
          }
          var AccessToken = this.options.custom && this.options.custom.AccessToken
                          ? this.options.app.models[this.options.custom.AccessToken]
                          : this.options.app.models.AccessToken;
          //verify credentials sent by the client
          var token = AccessToken.findOne({
            where: { id: token.id || 0 }
          }, (err: Error, tokenInstance: any) => {
            if (tokenInstance) {
              this.restoreNameSpaces(socket);
              socket.token = (<any>Object).assign({}, initialToken, tokenInstance);
              socket.emit('authenticated');
              this.options.app.emit('socket-authenticated', socket);
            }
          });
        });
        /**
         * Wait 1 second for token to be available
         * Or disconnect
         **/
        const to = setTimeout(() => {
          if (!socket.token) {
            socket.emit('unauthorized');
            socket.disconnect(1);
          }
          clearTimeout(to);
        }, 3000);
      });
    }
  }
  /**
   * @method setupClient
   * @description Will setup a server side client, for server-side notifications.
   * This is mainly created to be called from hooks
   **/
  setupClient(): void {
    // Passing transport options if any (Mostly for clustered environments)
    this.client = client(`http${this.options.secure ? 's' : ''}://127.0.0.1:${this.options.app.get('port')}`, {
      transports: ['websocket'],
      secure: this.options.secure
    });
    this.client.on('connect', () => {
      if (this.options.auth) {
        RealTimeLog.log('Server side client is connected, trying to authenticate');
        this.client.emit('authentication', { is: '-*!#fl1nter#!*-' });
        this.client.on('authenticated', () => RealTimeLog.log('Internal server client is authenticated'));
      }
    });
  }
  /**
   * @method setupInternal
   * @description Will setup an internal client that mainly will keep in sync different
   * server instances, is also used on.
   **/
  setupInternal(): void {
    // Passing transport options if any (Mostly for clustered environments)
    this.internal = client(`http${this.options.secure ? 's' : ''}://127.0.0.1:${this.options.app.get('port')}`, {
      transports: ['websocket'],
      secure: this.options.secure
    });
    this.internal.on('connect', () => {
      if (this.options.auth) {
        RealTimeLog.log('Internal client is connected, trying to authenticate');
        this.internal.emit('authentication', { is: '-*!#fl1nter#!*-' });
        this.internal.on('authenticated', () => {
          RealTimeLog.log('Internal client is authenticated');
          this.internal.emit('fl-reg');
        });
      } else {
        this.internal.emit('fl-reg');
      }
    });
  }

  emit(event: string, message: any): void {
    this.server.emit(event, message);
  }

  on(event: string, callback: Function): void {
    this.client.on(event, callback);
  }

  once(event: string, callback: Function): void {
    this.client.once(event, callback);
  }

  of(event: string): void {
    return this.server.of(event);
  }

  getUserConnection(userId: string): void {
    if (!userId || userId === '') return null;
    let connection: any;
    this.forEachConnection((_connection: any) => {
      if (_connection.token && _connection.token.userId === userId) {
        connection = _connection;
      }
    });
    return connection;
  }

  forEachConnection(handler: Function): void {
    this.connections.forEach((connection: any) => handler(connection));
  }

  onConnection(handler: Function): void {
    this.server.on('connect', (socket: any) => handler(socket, this.server));
  }

  removeListener(name: string, listener: Function): void {
    this.server.sockets.removeListener(name, listener);
  }

  newConnection(socket: any): void {
    this.connections.push(socket);
    socket.setMaxListeners(0);
    socket.on('ME:RT:1://event', (input: { event: string, data: any }) => {
      this.server.emit(input.event, input.data);
    });
    socket.on('disconnect', () => {
      this.options.app.emit('socket-disconnect', socket);
      socket.removeAllListeners();
    });
    socket.on('lb-ping', () => socket.emit('lb-pong', new Date().getTime() / 1000));
    socket.on('fl-reg', () => socket.join('flint'))
  }

  restoreNameSpaces(socket: any):void {
    _.each(this.server.nsps, (nsp: any) => {
      if (_.findWhere(nsp.sockets, { id: socket.id })) {
        nsp.connected[socket.id] = socket;
      }
    });
  }
}
