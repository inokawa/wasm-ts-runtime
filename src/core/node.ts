import type { Buffer } from "./buffer";

export class ModuleNode {
  magic: Uint8Array;
  version: Uint8Array;
  sections: SectionNode[] = [];

  constructor(buffer: Buffer) {
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);

    while (true) {
      if (buffer.eof) break;

      this.sections.push(loadSection(buffer));
    }
  }
}

type SectionNode = TypeSectionNode | FunctionSectionNode | CodeSectionNode;

const TYPE_SECTION_ID = 0x01;
const FUNCTION_SECTION_ID = 0x03;
const CODE_SECTION_ID = 0x0a;

const loadSection = (buffer: Buffer): SectionNode => {
  const sectionId = buffer.readByte();
  const sectionSize = buffer.readU32();
  const sectionsBuffer = buffer.readBuffer(sectionSize);

  switch (sectionId) {
    case TYPE_SECTION_ID:
      return new TypeSectionNode(sectionsBuffer);
    case FUNCTION_SECTION_ID:
      return new FunctionSectionNode(sectionsBuffer);
    case CODE_SECTION_ID:
      return new CodeSectionNode(sectionsBuffer);
    default:
      throw new Error(`invaild section id: ${sectionId}`);
  }
};

export class TypeSectionNode {
  funcTypes: FuncTypeNode[] = [];

  constructor(buffer: Buffer) {
    this.funcTypes = buffer.readVec(() => new FuncTypeNode(buffer));
  }
}

const FUNC_TYPE_TAG = 0x60;

const I32 = 0x7f;
const I64 = 0x7e;
const F32 = 0x7d;
const F64 = 0x7c;
type NumType = typeof I32 | typeof I64 | typeof F32 | typeof F64;
const FUNC_REF = 0x70;
const EXTERN_REF = 0x6f;
type RefType = typeof FUNC_REF | typeof EXTERN_REF;
type ValType = NumType | RefType;

export class FuncTypeNode {
  paramType: ResultTypeNode;
  resultType: ResultTypeNode;

  constructor(buffer: Buffer) {
    if (buffer.readByte() !== FUNC_TYPE_TAG) {
      throw new Error("invalid functype");
    }
    this.paramType = new ResultTypeNode(buffer);
    this.resultType = new ResultTypeNode(buffer);
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = [];

  constructor(buffer: Buffer) {
    this.valTypes = buffer.readVec(() => buffer.readByte() as ValType);
  }
}

type TypeIdx = number;

export class FunctionSectionNode {
  typeIdxs: TypeIdx[];

  constructor(buffer: Buffer) {
    this.typeIdxs = buffer.readVec(() => buffer.readU32() as TypeIdx);
  }
}

export class CodeSectionNode {
  codes: CodeNode[];

  constructor(buffer: Buffer) {
    this.codes = buffer.readVec(() => new CodeNode(buffer));
  }
}

export class CodeNode {
  size: number;
  func: FuncNode;

  constructor(buffer: Buffer) {
    this.size = buffer.readU32();
    this.func = new FuncNode(buffer.readBuffer(this.size));
  }
}

export class FuncNode {
  localses: LocalsNode[] = [];
  expr: ExprNode;

  constructor(buffer: Buffer) {
    this.localses = buffer.readVec(() => new LocalsNode(buffer));
    this.expr = new ExprNode(buffer);
  }
}

export class LocalsNode {
  num: number;
  valType: ValType;

  constructor(buffer: Buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte() as ValType;
  }
}

const OP_END = 0x0b;
const OP_LOCAL_GET = 0x20;
const OP_LOCAL_SET = 0x21;
const OP_I32_CONST = 0x41;
type Op =
  | typeof OP_END
  | typeof OP_LOCAL_GET
  | typeof OP_LOCAL_SET
  | typeof OP_I32_CONST;

type InstrNode = I32ConstInstrNode | LocalGetInstrNode | LocalSetInstrNode;

export class ExprNode {
  instrs: InstrNode[] = [];
  endOp!: typeof OP_END;

  constructor(buffer: Buffer) {
    while (true) {
      const opcode = buffer.readByte() as Op;
      if (opcode === OP_END) {
        this.endOp = opcode;
        break;
      }
      this.instrs.push(createInstrNode(opcode, buffer));
      if (buffer.eof) break;
    }
  }
}

const createInstrNode = (opcode: Op, buffer: Buffer) => {
  switch (opcode) {
    case OP_I32_CONST:
      return new I32ConstInstrNode(buffer);
    case OP_LOCAL_GET:
      return new LocalGetInstrNode(buffer);
    case OP_LOCAL_SET:
      return new LocalSetInstrNode(buffer);
    default:
      throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
  }
};

export class I32ConstInstrNode {
  op = OP_I32_CONST;
  num: number;

  constructor(buffer: Buffer) {
    this.num = buffer.readI32();
  }
}

export class LocalGetInstrNode {
  op = OP_LOCAL_GET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }
}

export class LocalSetInstrNode {
  op = OP_LOCAL_SET;
  localIdx: number;

  constructor(buffer: Buffer) {
    this.localIdx = buffer.readU32();
  }
}
