fn main() {
    let mut args = std::env::args().skip(1);
    let text = args.next().expect("text argument");
    let dictionary = args.next().map(|p| std::fs::read_to_string(p).expect("dictionary")).unwrap_or_default();
    println!("{}", eurorack_speech_planner::prepare(&text, &dictionary).expect("valid passage"));
}
