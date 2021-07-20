# @persona/microservice-emails

the email microservice for Persona project

## Configuration

Optional environment variables:

| Key                       | Type   | Description                                                             | Default                    |
|---------------------------|--------|-------------------------------------------------------------------------|----------------------------|
| `MONGO_CONNECTION_STRING` | string | mongodb connection url string                                           | `mongodb://localhost:27017`| 
| `BROKER_ADDR`             | string | the ZMQ address for broker to listen and for clients/workers to connect | `tcp://0.0.0.0:5555`       |

## Requirements

- a MongoDB instance (self-hosted or provider provisioned)
- project Persona [service broker](https://github.com/project-persona/infra#service-broker)

## Usage

You simply:

```
$ npm install
$ npm start
```
