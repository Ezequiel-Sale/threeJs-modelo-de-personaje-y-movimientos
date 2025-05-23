import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.176.0/build/three.module.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/loaders/FBXLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/controls/OrbitControls.js";

// Character proxy

class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }
  getAnimations() {
    return this._animations;
  }
}

// character controller

class BasicCharacterController {
  constructor(params) {
    this._params = params;
    this._deceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
      new BasicCharacterControllerProxy(this._animations)
    );
    this._loadModels();
  }

  _loadModels() {
    const loader = new FBXLoader();
    loader.setPath("./resources/warrior/");
    loader.load("warrior.fbx", (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse((c) => {
        c.castShadow = true;
      });
      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);
      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState("idle");
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);

        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

      const loader = new FBXLoader(this._manager);
      loader.setPath("./resources/warrior/");
      loader.load("idle.fbx", (anim) => {
        _OnLoad("idle", anim);
      });
      loader.load("walk.fbx", (anim) => {
        _OnLoad("walk", anim);
      });
      loader.load("run.fbx", (anim) => {
        _OnLoad("run", anim);
      });
      loader.load("runbackwards.fbx", (anim) => {
        _OnLoad("runbackwards", anim);
      });
      loader.load("walkback.fbx", (anim) => {
        _OnLoad("walkback", anim);
      });
      loader.load("attack.fbx", (anim) => {
        _OnLoad("attack", anim);
      });
    });
  }

  Update(timeInSeconds) {
    if (!this._target) return;
    this._stateMachine.Update(timeInSeconds, this._input);
    const velocity = this._velocity;
    const frameDeceleration = new THREE.Vector3(
      velocity.x * this._deceleration.x,
      velocity.y * this._deceleration.y,
      velocity.z * this._deceleration.z
    );
    frameDeceleration.multiplyScalar(timeInSeconds);
    frameDeceleration.z =
      Math.sign(frameDeceleration.z) *
      Math.min(Math.abs(frameDeceleration.z), Math.abs(velocity.z));

    velocity.add(frameDeceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();
    const acc = this._acceleration.clone();

    if (this._input._keys.shift) {
      acc.multiplyScalar(3.0);
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }

    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }

    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(
        _A,
        4.0 * Math.PI * timeInSeconds * this._acceleration.y
      );
      _R.multiply(_Q);
    }

    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(
        _A,
        4.0 * -Math.PI * timeInSeconds * this._acceleration.y
      );
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    oldPosition.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
}

// Character input
class BasicCharacterControllerInput {
  constructor() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shift: false,
      space: false,
    };
    document.addEventListener("keydown", (e) => this._onKeyDown(e), false);
    document.addEventListener("keyup", (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(e) {
    switch (e.keyCode) {
      case 87: // W
        this._keys.forward = true;
        break;
      case 83: // S
        this._keys.backward = true;
        break;
      case 65: // A
        this._keys.left = true;
        break;
      case 68: // D
        this._keys.right = true;
        break;
      case 16: // Shift
        this._keys.shift = true;
        break;
      case 32: // SPACE
        if (!this._keys.space)
          this._keys.space = true;
        break;
    }
  }
  _onKeyUp(e) {
    switch (e.keyCode) {
      case 87: // W
        this._keys.forward = false;
        break;
      case 83: // S
        this._keys.backward = false;
        break;
      case 65: // A
        this._keys.left = false;
        break;
      case 68: // D
        this._keys.right = false;
        break;
      case 16: // Shift
        this._keys.shift = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
    }
  }
}

// state machine
class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }
  _AddState(name, type) {
    this._states[name] = type;
  }
  SetState(name) {
    console.log(`Changing state to: ${name}`);
    const prevState = this._currentState;
    if (prevState) {
      if (prevState.Name == name) return;
      prevState.Exit();
    }
    const state = new this._states[name](this);
    this._currentState = state;
    state.Enter(prevState);
  }
  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
}

// character state machine

class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._AddState("idle", IdleState);
    this._AddState("walk", WalkState);
    this._AddState("run", RunState);
    this._AddState("runbackwards", RunBackwardsState);
    this._AddState("walkback", WalkBackState);
    this._AddState("attack", AttackState);
  }
}

// character states

class State {
  constructor(parent) {
    this._parent = parent;
  }
  Enter() {}
  Exit() {}
  Update() {}
}

class IdleState extends State {
  constructor(parent) {
    super(parent);
  }
  get Name() {
    return "idle";
  }
  Enter(prevState) {
    const idleAction = this._parent._proxy._animations["idle"].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }
  Exit() {}
  Update(_, input) {
    if (input._keys.forward) {
      this._parent.SetState("walk");
    }
    if (input._keys.backward) {
      this._parent.SetState("walkback");
    }
    if (input._keys.space) {
      this._parent.SetState("attack");
    }
  }
}

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }
  get Name() {
    return "walk";
  }
  Enter(prevState) {
    const currAction = this._parent._proxy._animations["walk"].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      currAction.enabled = true;

      if (prevState.Name == "run") {
        const ratio =
          currAction.getClip().duration / prevAction.getClip().duration;
        currAction.time = prevAction.time * ratio;
      } else {
        currAction.time = 0.0;
        currAction.setEffectiveTimeScale(1.0);
        currAction.setEffectiveWeight(1.0);
      }
      currAction.crossFadeFrom(prevAction, 0.5, true);
      currAction.play();
    } else {
      currAction.play();
    }
  }
  Exit() {}
  Update(_, input) {
    if (input._keys.forward) {
      if (input._keys.shift) {
        this._parent.SetState("run");
      }
      return;
    }
    this._parent.SetState("idle");
  }
}

class RunState extends State {
  constructor(parent) {
    super(parent);
  }
  get Name() {
    return "run";
  }
  Enter(prevState) {
    const currAction = this._parent._proxy._animations["run"].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      currAction.enabled = true;

      if (prevState.Name == "walk") {
        const ratio =
          currAction.getClip().duration / prevAction.getClip().duration;
        currAction.time = prevAction.time * ratio;
      } else {
        currAction.time = 0.0;
        currAction.setEffectiveTimeScale(1.0);
        currAction.setEffectiveWeight(1.0);
      }
      currAction.crossFadeFrom(prevAction, 0.5, true);
      currAction.play();
    } else {
      currAction.play();
    }
  }
  Exit() {}
  Update(_, input) {
    if (input._keys.forward) {
      if (!input._keys.shift) {
        this._parent.SetState("walk");
      }
      return;
    }
    this._parent.SetState("idle");
  }
}
class RunBackwardsState extends State {
  constructor(parent) {
    super(parent);
  }
  get Name() {
    return "runbackwards";
  }
  Enter(prevState) {
    console.log(`Entering state: ${this.Name}`);
    const currAction = this._parent._proxy._animations["runbackwards"].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      currAction.enabled = true;

      if (prevState.Name == "walkback") {
        const ratio =
          currAction.getClip().duration / prevAction.getClip().duration;
        currAction.time = prevAction.time * ratio;
      } else {
        currAction.time = 0.0;
        currAction.setEffectiveTimeScale(1.0);
        currAction.setEffectiveWeight(1.0);
      }
      currAction.crossFadeFrom(prevAction, 0.5, true);
      currAction.play();
    } else {
      currAction.play();
    }
  }
  Exit() {}
  Update(_, input) {
    console.log(`Updating state: ${this.Name}`);
    if (input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState("walkback");
      }
      return;
    }
    this._parent.SetState("idle");
  }
}
class WalkBackState extends State {
  constructor(parent) {
    super(parent);
  }
  get Name() {
    return "walkback";
  }
  Enter(prevState) {
    console.log(`Entering state: ${this.Name}`);
    const currAction = this._parent._proxy._animations["walkback"].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      currAction.enabled = true;

      if (prevState.Name == "runbackwards") {
        const ratio =
          currAction.getClip().duration / prevAction.getClip().duration;
        currAction.time = prevAction.time * ratio;
      } else {
        currAction.time = 0.0;
        currAction.setEffectiveTimeScale(1.0);
        currAction.setEffectiveWeight(1.0);
      }
      currAction.crossFadeFrom(prevAction, 0.5, true);
      currAction.play();
    } else {
      currAction.play();
    }
  }
  Exit() {}
  Update(_, input) {
    console.log(`Updating state: ${this.Name}`);
    if (input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState("runbackwards");
      }
      return;
    }

    this._parent.SetState("idle");
  }
}

class AttackState extends State {
  constructor(parent) {
    super(parent);
    this._finishedCallback = null; // Guarda la referencia al callback
  }

  get Name() {
    return "attack";
  }

  Enter(prevState) {
    console.log(`Entering state: ${this.Name}`);
    const currAction = this._parent._proxy._animations["attack"].action;

    // Limpia cualquier evento previo para evitar duplicados
    if (this._finishedCallback) {
      currAction.getMixer().removeEventListener("finished", this._finishedCallback);
    }

    // Define el callback para el evento "finished"
    this._finishedCallback = (e) => {
      if (this._parent._currentState.Name === "attack") {
        console.log("Jump attack finished, transitioning to idle");
        this._parent.SetState("idle"); // Cambia al estado idle cuando termine
      }
    };

    // Registra el evento "finished"
    currAction.getMixer().addEventListener("finished", this._finishedCallback);

    // Configura y reproduce la animación
    currAction.enabled = true;
    currAction.loop = THREE.LoopOnce; // Ejecuta la animación solo una vez
    currAction.clampWhenFinished = true; // Detiene la animación al final
    currAction.time = 0.0; // Reinicia la animación
    currAction.reset(); // Asegúrate de reiniciar la animación
    currAction.setEffectiveTimeScale(1.0);
    currAction.setEffectiveWeight(1.0);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      currAction.crossFadeFrom(prevAction, 0.5, true);
    }

    currAction.play();
  }

  Exit() {
    const currAction = this._parent._proxy._animations["attack"].action;

    // Elimina el evento "finished" para evitar duplicados
    if (this._finishedCallback) {
      currAction.getMixer().removeEventListener("finished", this._finishedCallback);
      this._finishedCallback = null; // Limpia la referencia al callback
    }
  }

  Update(_, input) {
    console.log(`Updating state: ${this.Name}`);
    // No permite transiciones adicionales mientras se ejecuta el ataque
  }
}
// scene

class DemoScene {
  constructor() {
    this._threejs = new THREE.WebGLRenderer({ antialias: true });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this._threejs.domElement);

    window.addEventListener(
      "resize",
      () => {
        this._OnWindowResize();
      },
      false
    );

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 10, 25);

    this._scene = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xffffff, 3.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = -50;
    light.shadow.camera.right = 50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xffffff, 0.25);
    this._scene.add(light);

    const controls = new OrbitControls(this._camera, this._threejs.domElement);
    controls.target.set(0, 10, 0);
    controls.update();

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x808080 })
    );
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);

    this._mixers = [];
    this._previousRAF = null;
    this._LoadAnimateModel();
    this._RAF();
  }

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _LoadAnimateModel() {
    const params = {
      scene: this._scene,
      camera: this._camera,
    };
    this._controls = new BasicCharacterController(params);
  }

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }

      this._RAF();
      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }
  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map((m) => m.update(timeElapsedS));
    }
    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }
  }
}

let _APP = null;

window.addEventListener("DOMContentLoaded", () => {
  _APP = new DemoScene();
});
