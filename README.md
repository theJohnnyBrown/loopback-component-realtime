
# LoopBack Component Real-Time

A [LoopBack Framework](http://loopback.io) Component that provides publish events over WebSockets.

This module will supersedes the [LoopBack Component PubSub](https://github.com/mean-expert-official/loopback-component-pubsub) and will implement multiple Real-Time functionalities like PubSub, IO and the new [FireLoop Module](https://github.com/mean-expert-official/loopback-sdk-builder/wiki/8.-(NEW)-FireLoop-API).

# Installation

````sh
$ npm install --save @mean-expert/{loopback-sdk-builder,loopback-component-realtime}
````

# Setup Back End Module

Update the  `server/component-config.json` as follows:

````json
{
  "loopback-component-explorer": {
    "mountPath": "/explorer"
  },
  "@mean-expert/loopback-component-realtime": {
    "debug": true,
    "auth": true,
    "driver": {
      "name": "socket.io"
    },
    "modules": [
      "IO",
      "PubSub",
      "FireLoop"
    ]
  }
}

````

Update the  `server/model-config.json` as follows:

````json
{
    "mixins": [
        "loopback/common/mixins",
        "loopback/server/mixins",
        "../common/mixins",
        "./mixins",
        "../node_modules/loopback-component-realtime/dist/mixins"
    ]
}
````



# PRESENTING FIRELOOP.IO (NEW)
[![FireLoop.io](https://storage.googleapis.com/mean-expert-images/fireloop-logo.png)](https://github.com/mean-expert-official/loopback-sdk-builder/wiki/8.-(NEW)-FireLoop-API)

# Generate FireLoop Angular 2 Client
FireLoop Client for Angular 2 Applications are built in when generating your LoopBack SDK. Read the [Following Instructions](https://github.com/mean-expert-official/loopback-sdk-builder/wiki/1.-Install-Builder-&-Build-SDK) in order to automatically generate your software development kit.






